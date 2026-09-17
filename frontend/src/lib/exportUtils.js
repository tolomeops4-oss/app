import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  downloadBlob(blob, filename);
}

function _slug_removed_duplicate(s) { return s; }

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

// ---------- PDF ----------
function bearingLabel(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(((deg % 360) / 45)) % 8;
  return dirs[idx];
}

function slug(s) {
  return (s || "campo").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function downloadBlob(blob, filename) {
  // Universal blob download compatible with Android Chrome, iOS Safari, desktop
  const blobUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (e) {
    // Fallback: open in new tab
    window.open(blobUrl, "_blank");
  }
  // Release object URL later
  setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (e) {} }, 30000);
}

export async function exportPDF({ field, plan, irrigationResult, mapElement }) {
  const materials = plan ? {
    endPosts: plan.rows.reduce((s, r) => s + 2, 0),
    intermediatePosts: plan.rows.reduce((s, r) => s + Math.max(0, Math.floor(r.length / 6) - 1), 0),
    tutors: plan.totalPlants,
    wireMeters: plan.totalRowMeters * 2,
  } : null;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(11, 14, 12);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(56, 224, 122);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("PROGETTO OLIVETO", 14, 13);
  doc.setTextColor(220, 220, 220);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Scheda Tecnica Impianto  \u2022  ${field.name}`, 14, 20);
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }), pageW - 14, 13, { align: "right" });
  doc.text(`Varietà: ${field.config.variety}`, pageW - 14, 20, { align: "right" });

  let y = 34;

  // Map snapshot
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, { useCORS: true, allowTaint: true, backgroundColor: "#0b0e0c", scale: 1.5, logging: false });
      const imgData = canvas.toDataURL("image/jpeg", 0.82);
      const imgW = pageW - 28;
      const imgH = (canvas.height / canvas.width) * imgW;
      const finalH = Math.min(imgH, 90);
      doc.addImage(imgData, "JPEG", 14, y, imgW, finalH, undefined, "FAST");
      y += finalH + 6;
    } catch (e) { /* skip */ }
  }

  // Compute values
  const areaGrossHa = (plan?.areaGross || 0) / 10000;
  const areaPlantableHa = (plan?.areaPlantable || 0) / 10000;
  const azValue = field.azimuth || 0;
  const emitterCount = irrigationResult?.totalEmitters ?? 0;
  const flowM3h = irrigationResult?.totalFlowM3h ?? 0;

  // General params table
  const generalBody = [
    ["Superficie Lorda", `${areaGrossHa.toFixed(3)} ha (${(plan?.areaGross || 0).toFixed(0)} m²)`],
    ["Superficie Impiantata", `${areaPlantableHa.toFixed(3)} ha (${(plan?.areaPlantable || 0).toFixed(0)} m²)`],
    ["Perimetro", `${(plan?.perimeter || 0).toFixed(1)} m`],
    ["Interfilare / Sesto", `${field.config.interRow.toFixed(2)} m × ${field.config.interPlant.toFixed(2)} m`],
    ["Capezzagna Testata / Margine Laterale", `${field.config.headland.toFixed(1)} m / ${field.config.sideMargin.toFixed(1)} m`],
    ["Orientamento Filari", `${azValue.toFixed(1)}° ${bearingLabel(azValue)}`],
    ["Filari Totali", `${plan?.rows?.length ?? 0} (di cui ${plan?.shortRowCount ?? 0} corti)`],
    ["Metri Lineari Filari", `${(plan?.totalRowMeters || 0).toFixed(1)} m`],
    ["Lunghezza Media / Min / Max Filare", `${(plan?.avgRowLength || 0).toFixed(1)} / ${(plan?.minRowLength || 0).toFixed(1)} / ${(plan?.maxRowLength || 0).toFixed(1)} m`],
    ["Piante Totali", `${plan?.totalPlants ?? 0}`],
    ["Densità Reale", `${(plan?.density || 0).toFixed(0)} piante/ha`],
  ];
  autoTable(doc, {
    startY: y,
    head: [["Parametro Agronomico", "Valore"]],
    body: generalBody,
    theme: "striped",
    headStyles: { fillColor: [34, 60, 112], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 4;

  // Irrigation table
  if (irrigationResult) {
    const irrBody = [
      ["Ali per Fila", `${field.irrigation.linesPerRow}`],
      ["Portata Gocciolatore", `${field.irrigation.emitterFlow.toFixed(2)} L/h`],
      ["Passo Gocciolatori", `${field.irrigation.emitterSpacing.toFixed(2)} m`],
      ["Metri Lineari Ala", `${irrigationResult.totalMeters.toFixed(1)} m`],
      ["Numero Gocciolatori", `${emitterCount}`],
      ["Portata Totale Impianto", `${flowM3h.toFixed(2)} m³/h`],
      ["Portata Max Settore", `${irrigationResult.maxSectorM3h.toFixed(2)} m³/h`],
      ["Volume 1h (settore)", `${irrigationResult.volumePerHourM3.toFixed(2)} m³ - ${irrigationResult.mmEquivalent.toFixed(2)} mm eq.`],
      ["Pompa Dichiarata", `${field.irrigation.pumpCapacity.toFixed(1)} m³/h${irrigationResult.exceedsPump ? "  ⚠ SUPERATA" : ""}`],
    ];
    autoTable(doc, {
      startY: y,
      head: [["Impianto Irrigazione a Goccia", "Valore"]],
      body: irrBody,
      theme: "striped",
      headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;

    // Sector detail
    if (irrigationResult.sectors?.length) {
      autoTable(doc, {
        startY: y,
        head: [["Settore", "Filari", "Metri Ala", "Gocciolatori", "m³/h", "L/min"]],
        body: irrigationResult.sectors.map((s) => [
          `#${s.index + 1}`, s.rows, s.meters.toFixed(1), s.emitters, s.flowM3h.toFixed(2), s.flowLmin.toFixed(1),
        ]),
        theme: "grid",
        headStyles: { fillColor: [14, 116, 144], textColor: [255, 255, 255], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 4;
    }
  }

  // Materials
  if (materials) {
    autoTable(doc, {
      startY: y,
      head: [["Stima Materiali Struttura", "Quantità"]],
      body: [
        ["Pali di Testata (2 per filare)", `${materials.endPosts}`],
        ["Pali Intermedi (passo 6 m)", `${materials.intermediatePosts}`],
        ["Tutori (uno per pianta)", `${materials.tutors}`],
        ["Filo Zincato (2 fili per fila)", `${materials.wireMeters.toFixed(0)} m`],
      ],
      theme: "striped",
      headStyles: { fillColor: [69, 44, 26], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 4;
  }

  // Row detail (new page if needed)
  if (plan?.rows?.length) {
    if (y > 240) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y,
      head: [["ID Filare", "Lung. (m)", "Piante", "Corto", "Lat inizio", "Lng inizio", "Lat fine", "Lng fine"]],
      body: plan.rows.map((r) => [
        r.id, r.length.toFixed(1), r.plants.length, r.isShort ? "SI" : "NO",
        r.start.lat.toFixed(5), r.start.lng.toFixed(5), r.end.lat.toFixed(5), r.end.lng.toFixed(5),
      ]),
      theme: "grid",
      headStyles: { fillColor: [34, 60, 112], textColor: [255, 255, 255], fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 1 },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Progetto Oliveto  \u2022  Scheda Tecnica  \u2022  Pagina ${i}/${pageCount}`, pageW / 2, 292, { align: "center" });
  }

  // Universal blob download (Android Chrome compatible)
  const blob = doc.output("blob");
  downloadBlob(blob, `Scheda_Tecnica_${slug(field.name)}.pdf`);
}
