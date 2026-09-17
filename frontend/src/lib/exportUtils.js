import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { v4 as uuidv4 } from "uuid";

// ---------- Import GeoJSON ----------
export function parseGeoJSONForField(gj) {
  if (!gj || (gj.type !== "FeatureCollection" && gj.type !== "Feature" && gj.type !== "Polygon")) {
    throw new Error("Formato GeoJSON non valido");
  }
  const features = gj.type === "FeatureCollection" ? gj.features : [gj.type === "Feature" ? gj : { type: "Feature", geometry: gj, properties: {} }];
  let vertices = null;
  const obstacles = [];
  for (const feat of features) {
    if (!feat.geometry) continue;
    const kind = feat.properties?.kind;
    if (feat.geometry.type === "Polygon") {
      if (!vertices || kind === "field_boundary") {
        const ring = feat.geometry.coordinates[0];
        vertices = ring.slice(0, -1).map((c) => ({ id: uuidv4(), lat: c[1], lng: c[0] }));
      } else if (kind === "obstacle") {
        const ring = feat.geometry.coordinates[0];
        obstacles.push({
          id: uuidv4(),
          type: feat.properties?.obstacleType || "fabbricato",
          geomType: "polygon",
          points: ring.slice(0, -1).map((c) => ({ id: uuidv4(), lat: c[1], lng: c[0] })),
          bufferAlong: 4.0, bufferSide: 2.0,
          label: feat.properties?.label || "",
        });
      }
    } else if (feat.geometry.type === "Point" && kind === "obstacle") {
      obstacles.push({
        id: uuidv4(),
        type: feat.properties?.obstacleType || "palo",
        geomType: "point",
        points: [{ id: uuidv4(), lat: feat.geometry.coordinates[1], lng: feat.geometry.coordinates[0] }],
        bufferAlong: 4.0, bufferSide: 2.0,
      });
    }
  }
  if (!vertices || vertices.length < 3) throw new Error("Nessun perimetro (Polygon) valido trovato nel file");
  return { vertices, obstacles };
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ---------- Materials estimate ----------
export function estimateMaterials(plan, options = {}) {
  if (!plan || !plan.rows) return null;
  const postSpacing = options.postSpacing || 6.0; // m between intermediate posts
  const wiresPerRow = options.wiresPerRow || 2;
  let endPosts = 0;
  let intermediatePosts = 0;
  let tutors = 0;
  let wireMeters = 0;
  for (const r of plan.rows) {
    endPosts += 2;
    intermediatePosts += Math.max(0, Math.floor(r.length / postSpacing) - 1);
    tutors += r.plants.length;
    wireMeters += r.length * wiresPerRow;
  }
  return { endPosts, intermediatePosts, totalPosts: endPosts + intermediatePosts, tutors, wireMeters };
}

// ---------- GeoJSON export ----------
export function buildGeoJSON(field, plan, irrigation) {
  const features = [];
  if (field.vertices && field.vertices.length >= 3) {
    const coords = field.vertices.map((v) => [v.lng, v.lat]);
    coords.push([...coords[0]]);
    features.push({
      type: "Feature",
      properties: { kind: "field_boundary", name: field.name, azimuth: field.azimuth },
      geometry: { type: "Polygon", coordinates: [coords] },
    });
  }
  for (const obs of field.obstacles || []) {
    if (obs.geomType === "point") {
      features.push({
        type: "Feature",
        properties: { kind: "obstacle", obstacleType: obs.type, label: obs.label || "" },
        geometry: { type: "Point", coordinates: [obs.points[0].lng, obs.points[0].lat] },
      });
    } else if (obs.points.length >= 3) {
      const c = obs.points.map((p) => [p.lng, p.lat]);
      c.push([...c[0]]);
      features.push({
        type: "Feature",
        properties: { kind: "obstacle", obstacleType: obs.type, label: obs.label || "" },
        geometry: { type: "Polygon", coordinates: [c] },
      });
    }
  }
  if (plan?.rows) {
    for (const row of plan.rows) {
      features.push({
        type: "Feature",
        properties: { kind: "row", id: row.id, length: row.length, plants: row.plants.length, isShort: row.isShort },
        geometry: { type: "LineString", coordinates: [[row.start.lng, row.start.lat], [row.end.lng, row.end.lat]] },
      });
      for (const p of row.plants) {
        features.push({
          type: "Feature",
          properties: { kind: "plant", id: p.id, rowId: row.id },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        });
      }
    }
  }
  for (const el of field.networkElements || []) {
    features.push({
      type: "Feature",
      properties: { kind: "network_element", elementType: el.type, label: el.label || "", sector: el.sectorIndex },
      geometry: { type: "Point", coordinates: [el.lng, el.lat] },
    });
  }
  return { type: "FeatureCollection", features };
}

export function downloadFile(filename, content, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportGeoJSON(field, plan) {
  const gj = buildGeoJSON(field, plan);
  downloadFile(`${slug(field.name)}_geojson.geojson`, JSON.stringify(gj, null, 2));
}

export function exportRowsCSV(field, plan) {
  if (!plan) return;
  const rows = [["id_filare", "indice", "lunghezza_m", "n_piante", "corto", "lat_start", "lng_start", "lat_end", "lng_end"]];
  for (const r of plan.rows) {
    rows.push([r.id, r.index, r.length.toFixed(2), r.plants.length, r.isShort ? "SI" : "NO",
      r.start.lat.toFixed(6), r.start.lng.toFixed(6), r.end.lat.toFixed(6), r.end.lng.toFixed(6)]);
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadFile(`${slug(field.name)}_filari.csv`, csv, "text/csv");
}

export function exportPlantsCSV(field, plan) {
  if (!plan) return;
  const rows = [["id_pianta", "id_filare", "lat", "lng"]];
  for (const r of plan.rows) {
    for (const p of r.plants) {
      rows.push([p.id, r.id, p.lat.toFixed(6), p.lng.toFixed(6)]);
    }
  }
  const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  downloadFile(`${slug(field.name)}_piante.csv`, csv, "text/csv");
}

function csvEscape(v) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slug(s) {
  return (s || "campo").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

// ---------- PDF ----------
export async function exportPDF({ field, plan, irrigationResult, mapElement }) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  let y = 12;

  // Header
  pdf.setFillColor(11, 14, 12);
  pdf.rect(0, 0, pageW, 26, "F");
  pdf.setTextColor(56, 224, 122);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("PROGETTO OLIVETO", 12, 12);
  pdf.setTextColor(230, 230, 230);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Relazione Tecnica Impianto Superintensivo", 12, 18);
  pdf.setFontSize(7);
  pdf.text(new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }), pageW - 12, 12, { align: "right" });
  y = 32;

  // Field info
  pdf.setTextColor(20, 20, 20);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(`Campo: ${field.name}`, 12, y); y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Varieta: ${field.config.variety}    Azimut file: ${field.azimuth.toFixed(1)}°`, 12, y); y += 5;
  pdf.text(`Sesto: ${field.config.interRow.toFixed(2)} m x ${field.config.interPlant.toFixed(2)} m`, 12, y); y += 5;
  pdf.text(`Capezzagna testata: ${field.config.headland.toFixed(1)} m    Margine laterale: ${field.config.sideMargin.toFixed(1)} m`, 12, y); y += 8;

  // Map snapshot
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, { useCORS: true, backgroundColor: "#0b0e0c", scale: 1.5, logging: false });
      const imgData = canvas.toDataURL("image/jpeg", 0.8);
      const imgW = pageW - 24;
      const imgH = (canvas.height / canvas.width) * imgW;
      const finalH = Math.min(imgH, 100);
      pdf.addImage(imgData, "JPEG", 12, y, imgW, finalH, undefined, "FAST");
      y += finalH + 6;
    } catch (e) { /* skip if map render fails */ }
  }

  // Metrics
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Computo Tecnico Impianto", 12, y); y += 6;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const lines = [
    ["Superficie Lorda", `${(plan?.areaGross || 0).toFixed(0)} m² (${((plan?.areaGross || 0) / 10000).toFixed(3)} ha)`],
    ["Superficie Impiantabile", `${(plan?.areaPlantable || 0).toFixed(0)} m² (${((plan?.areaPlantable || 0) / 10000).toFixed(3)} ha)`],
    ["Perimetro", `${(plan?.perimeter || 0).toFixed(1)} m`],
    ["Numero Filari", `${plan?.rows?.length || 0} (di cui ${plan?.shortRowCount || 0} corti)`],
    ["Lunghezza Media Filare", `${(plan?.avgRowLength || 0).toFixed(1)} m`],
    ["Lunghezza Min / Max Filare", `${(plan?.minRowLength || 0).toFixed(1)} m / ${(plan?.maxRowLength || 0).toFixed(1)} m`],
    ["Metri Lineari Totali Filari", `${(plan?.totalRowMeters || 0).toFixed(1)} m`],
    ["Piante Totali", `${plan?.totalPlants || 0}`],
    ["Densita Reale", `${(plan?.density || 0).toFixed(0)} piante/ha`],
  ];
  for (const [k, v] of lines) {
    pdf.text(k, 14, y);
    pdf.text(String(v), pageW - 14, y, { align: "right" });
    y += 5;
    if (y > 280) { pdf.addPage(); y = 20; }
  }

  // Irrigation
  if (irrigationResult) {
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Impianto Irrigazione a Goccia", 12, y); y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const ir = irrigationResult;
    const irrLines = [
      ["Ali per Fila", `${field.irrigation.linesPerRow}`],
      ["Portata Gocciolatore", `${field.irrigation.emitterFlow} L/h`],
      ["Passo Gocciolatori", `${field.irrigation.emitterSpacing} m`],
      ["Metri Lineari Ala Gocciolante", `${ir.totalMeters.toFixed(1)} m`],
      ["Numero Gocciolatori", `${ir.totalEmitters}`],
      ["Portata Totale Impianto", `${ir.totalFlowM3h.toFixed(2)} m³/h`],
      ["Portata Max Settore", `${ir.maxSectorM3h.toFixed(2)} m³/h`],
      ["Volume 1h (settore)", `${ir.volumePerHourM3.toFixed(2)} m³ (${ir.mmEquivalent.toFixed(2)} mm eq.)`],
    ];
    for (const [k, v] of irrLines) {
      pdf.text(k, 14, y);
      pdf.text(String(v), pageW - 14, y, { align: "right" });
      y += 5;
      if (y > 280) { pdf.addPage(); y = 20; }
    }
    if (ir.exceedsPump) {
      y += 2;
      pdf.setTextColor(220, 60, 60);
      pdf.text(`⚠ Portata settore max (${ir.maxSectorM3h.toFixed(2)} m³/h) supera pompa dichiarata (${field.irrigation.pumpCapacity} m³/h)`, 14, y);
      pdf.setTextColor(20, 20, 20);
      y += 5;
    }

    // Sector table
    y += 4;
    pdf.setFont("helvetica", "bold");
    pdf.text("Settori Irrigui", 12, y); y += 5;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text("Settore", 14, y);
    pdf.text("Filari", 40, y);
    pdf.text("Metri Ala", 65, y);
    pdf.text("Gocc.", 95, y);
    pdf.text("m³/h", 120, y);
    pdf.text("L/min", 150, y);
    y += 4;
    pdf.setLineWidth(0.2);
    pdf.line(12, y - 2, pageW - 12, y - 2);
    for (const s of ir.sectors) {
      pdf.text(`#${s.index + 1}`, 14, y);
      pdf.text(String(s.rows), 40, y);
      pdf.text(s.meters.toFixed(1), 65, y);
      pdf.text(String(s.emitters), 95, y);
      pdf.text(s.flowM3h.toFixed(2), 120, y);
      pdf.text(s.flowLmin.toFixed(1), 150, y);
      y += 4;
      if (y > 285) { pdf.addPage(); y = 20; }
    }
  }

  // Footer
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Progetto Oliveto - Pagina ${i}/${pageCount}`, pageW / 2, 292, { align: "center" });
  }

  pdf.save(`${slug(field.name)}_report_tecnico.pdf`);
}
