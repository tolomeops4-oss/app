// Geometric engine for Progetto Oliveto using Turf.js
import * as turf from "@turf/turf";

const M_TO_DEG_LAT = 1 / 111320;
function mToDegLng(lat) { return 1 / (111320 * Math.cos((lat * Math.PI) / 180)); }

// ---------- Basics ----------

export function verticesToPolygon(vertices) {
  if (!vertices || vertices.length < 3) return null;
  const coords = vertices.map((v) => [v.lng, v.lat]);
  coords.push([...coords[0]]);
  try {
    return turf.polygon([coords]);
  } catch (e) {
    return null;
  }
}

export function polygonAreaM2(polygon) {
  if (!polygon) return 0;
  return turf.area(polygon);
}

export function polygonPerimeterM(polygon) {
  if (!polygon) return 0;
  try {
    const line = turf.polygonToLine(polygon);
    if (line.type === "Feature" && line.geometry.type === "LineString") {
      return turf.length(line, { units: "meters" });
    }
    // MultiLineString
    let total = 0;
    if (line.features) {
      for (const f of line.features) total += turf.length(f, { units: "meters" });
    }
    return total;
  } catch (e) { return 0; }
}

// ---------- Obstacle asymmetric buffer (rectangle along/side of azimuth) ----------

export function obstacleToFeature(obstacle) {
  if (!obstacle || !obstacle.points || obstacle.points.length === 0) return null;
  if (obstacle.geomType === "point") {
    return turf.point([obstacle.points[0].lng, obstacle.points[0].lat]);
  }
  if (obstacle.points.length < 3) {
    // treat as point
    return turf.point([obstacle.points[0].lng, obstacle.points[0].lat]);
  }
  const coords = obstacle.points.map((p) => [p.lng, p.lat]);
  coords.push([...coords[0]]);
  try { return turf.polygon([coords]); } catch(e){ return null; }
}

export function bufferObstacleRect(obstacle, azimuthDeg, alongM, sideM) {
  const feat = obstacleToFeature(obstacle);
  if (!feat) return null;
  const centroid = turf.centroid(feat);
  const rotated = turf.transformRotate(feat, -azimuthDeg, { pivot: centroid });
  const bb = turf.bbox(rotated);
  // In rotated frame the row direction is North (bearing 0). Along = N/S, Side = E/W.
  const sw = turf.point([bb[0], bb[1]]);
  const ne = turf.point([bb[2], bb[3]]);
  const swW = turf.destination(sw, sideM, -90, { units: "meters" });
  const swWS = turf.destination(swW, alongM, 180, { units: "meters" });
  const neE = turf.destination(ne, sideM, 90, { units: "meters" });
  const neEN = turf.destination(neE, alongM, 0, { units: "meters" });
  const [minLng, minLat] = swWS.geometry.coordinates;
  const [maxLng, maxLat] = neEN.geometry.coordinates;
  const rect = turf.polygon([[
    [minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat],
  ]]);
  return turf.transformRotate(rect, azimuthDeg, { pivot: centroid });
}

// ---------- Row generation ----------

function safeBuffer(poly, distMeters) {
  try {
    const b = turf.buffer(poly, distMeters, { units: "meters" });
    return b || null;
  } catch (e) { return null; }
}

function safeDifference(a, b) {
  try {
    // turf v7 style: featureCollection input
    const fc = turf.featureCollection([a, b]);
    const d = turf.difference(fc);
    return d || null;
  } catch (e) {
    try { return turf.difference(a, b) || null; } catch(_){ return null; }
  }
}

function clipHorizontalLineToPolygon(y, polygon) {
  // Fast intersection for a horizontal line y=const within polygon (in rotated frame)
  // Returns array of {x1,x2} segments
  const rings = polygon.geometry.type === "Polygon"
    ? [polygon.geometry.coordinates]
    : polygon.geometry.coordinates;
  const xs = new Set();
  const allXs = [];
  for (const poly of rings) {
    for (const ring of poly) {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1] = ring[i];
        const [x2, y2] = ring[i + 1];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
          const t = (y - y1) / (y2 - y1);
          const x = x1 + t * (x2 - x1);
          allXs.push(x);
        }
      }
    }
  }
  allXs.sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i + 1 < allXs.length; i += 2) {
    segments.push({ x1: allXs[i], x2: allXs[i + 1] });
  }
  return segments;
}

export function generatePlan(field) {
  const { vertices, obstacles = [], config, azimuth = 0 } = field;
  const { interRow, interPlant, headland, sideMargin, minSegment } = config;
  const fieldPoly = verticesToPolygon(vertices);
  if (!fieldPoly) return null;

  const areaGross = turf.area(fieldPoly);

  // Apply lateral margin as isotropic negative buffer (safe fallback).
  let plantablePoly = sideMargin > 0 ? safeBuffer(fieldPoly, -sideMargin) : fieldPoly;
  if (!plantablePoly) plantablePoly = fieldPoly;

  // Subtract obstacle buffers
  const obstacleBuffers = [];
  for (const obs of obstacles) {
    const buf = bufferObstacleRect(obs, azimuth, obs.bufferAlong, obs.bufferSide);
    if (!buf) continue;
    obstacleBuffers.push(buf);
    const diff = safeDifference(plantablePoly, buf);
    if (diff) plantablePoly = diff;
  }

  const areaPlantable = turf.area(plantablePoly);

  // Rotate plantablePoly so azimuth aligns with North (Y axis)
  const centroid = turf.centroid(fieldPoly);
  const rotatedPoly = turf.transformRotate(plantablePoly, -azimuth, { pivot: centroid });
  const bb = turf.bbox(rotatedPoly);
  const [minLng, minLat, maxLng, maxLat] = bb;
  const midLat = (minLat + maxLat) / 2;

  const rowDeltaLat = interRow * M_TO_DEG_LAT;
  const startY = minLat + rowDeltaLat / 2;

  const rows = [];
  let rowIdx = 0;
  for (let y = startY; y <= maxLat; y += rowDeltaLat) {
    const xSegments = clipHorizontalLineToPolygon(y, rotatedPoly);
    for (const seg of xSegments) {
      // Build a line feature in rotated frame
      const linRot = turf.lineString([[seg.x1, y], [seg.x2, y]]);
      const segLenM = turf.length(linRot, { units: "meters" });
      if (segLenM < 2 * headland + 0.1) {
        // even after headland trim nothing left
        continue;
      }
      // Trim headland from both ends
      const start = turf.along(linRot, headland, { units: "meters" });
      const end = turf.along(linRot, segLenM - headland, { units: "meters" });
      const trimmedRot = turf.lineString([start.geometry.coordinates, end.geometry.coordinates]);
      const trimmedLen = turf.length(trimmedRot, { units: "meters" });
      if (trimmedLen < 0.5) continue;

      // Place plants
      const plantsRot = [];
      let d = 0;
      while (d <= trimmedLen + 0.001) {
        const pt = turf.along(trimmedRot, d, { units: "meters" });
        plantsRot.push(pt.geometry.coordinates);
        d += interPlant;
      }

      // Rotate back
      const trimmedFinal = turf.transformRotate(trimmedRot, azimuth, { pivot: centroid });
      const plantsFinalCoords = plantsRot.map((c) => {
        const p = turf.transformRotate(turf.point(c), azimuth, { pivot: centroid });
        return p.geometry.coordinates;
      });

      const coords = trimmedFinal.geometry.coordinates;
      rows.push({
        id: `row-${rowIdx}-${rows.length}`,
        index: rowIdx,
        start: { lat: coords[0][1], lng: coords[0][0] },
        end: { lat: coords[1][1], lng: coords[1][0] },
        length: trimmedLen,
        isShort: trimmedLen < minSegment,
        plants: plantsFinalCoords.map((c, i) => ({
          id: `plant-${rowIdx}-${rows.length}-${i}`,
          lat: c[1],
          lng: c[0],
          rowId: `row-${rowIdx}-${rows.length}`,
        })),
      });
    }
    rowIdx++;
  }

  const totalPlants = rows.reduce((s, r) => s + r.plants.length, 0);
  const totalRowMeters = rows.reduce((s, r) => s + r.length, 0);
  const validRows = rows.filter((r) => !r.isShort);
  const shortRows = rows.filter((r) => r.isShort);
  const rowLengths = rows.map((r) => r.length);

  return {
    areaGross,
    areaPlantable,
    perimeter: polygonPerimeterM(fieldPoly),
    rows,
    plantablePolygon: plantablePoly,
    obstacleBuffers,
    totalPlants,
    validRowCount: validRows.length,
    shortRowCount: shortRows.length,
    totalRowMeters,
    minRowLength: rowLengths.length ? Math.min(...rowLengths) : 0,
    maxRowLength: rowLengths.length ? Math.max(...rowLengths) : 0,
    avgRowLength: rowLengths.length ? totalRowMeters / rowLengths.length : 0,
    density: areaPlantable > 0 ? totalPlants / (areaPlantable / 10000) : 0,
  };
}

// ---------- Azimuth optimization ----------

export function optimizeAzimuth(field, step = 5) {
  const angles = [];
  for (let a = 0; a < 180; a += step) angles.push(a);
  const scored = [];
  for (const a of angles) {
    const plan = generatePlan({ ...field, azimuth: a });
    if (!plan) continue;
    const score = plan.totalPlants - 3 * plan.shortRowCount + plan.avgRowLength * 0.05;
    scored.push({ azimuth: a, score, plan });
  }
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] || null;
  const top3 = scored.slice(0, 3);
  return best ? { ...best, top3 } : null;
}

// Compute azimuths of every edge of the polygon (0-359, then normalize to 0-179)
export function polygonEdgeAzimuths(vertices) {
  if (!vertices || vertices.length < 3) return [];
  const results = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const bearing = turf.bearing(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat]));
    // bearing is -180..180 from North; normalize to 0..179 (rows have no direction)
    let deg = ((bearing % 360) + 360) % 360;
    if (deg >= 180) deg -= 180;
    const len = turf.distance(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat]), { units: "meters" });
    results.push({ index: i, azimuth: deg, length: len, from: a, to: b });
  }
  return results;
}

// ---------- Irrigation calculations ----------

export function computeIrrigation(plan, irrigation) {
  if (!plan) return null;
  const { rows } = plan;
  const {
    linesPerRow, emitterFlow, emitterSpacing, pumpCapacity,
    numSectors, sectorMode, manualAssignments,
  } = irrigation;

  // Assign sector to each row
  const assignments = {};
  if (sectorMode === "manual") {
    for (const r of rows) {
      const s = manualAssignments?.[r.id];
      assignments[r.id] = typeof s === "number" ? s : 0;
    }
  } else {
    // Auto: group rows by index bands
    const nSectors = Math.max(1, numSectors);
    const chunk = Math.ceil(rows.length / nSectors);
    rows.forEach((r, i) => {
      assignments[r.id] = Math.min(nSectors - 1, Math.floor(i / chunk));
    });
  }

  const sectors = {};
  for (const r of rows) {
    const s = assignments[r.id] ?? 0;
    if (!sectors[s]) sectors[s] = { index: s, rows: 0, meters: 0, emitters: 0, plants: 0 };
    sectors[s].rows += 1;
    sectors[s].meters += r.length * linesPerRow;
    sectors[s].emitters += Math.floor((r.length / emitterSpacing) + 1) * linesPerRow;
    sectors[s].plants += r.plants.length;
  }
  const sectorList = Object.values(sectors).sort((a, b) => a.index - b.index).map((s) => ({
    ...s,
    flowLh: s.emitters * emitterFlow,
    flowM3h: (s.emitters * emitterFlow) / 1000,
    flowLmin: (s.emitters * emitterFlow) / 60,
  }));

  const totalMeters = sectorList.reduce((s, x) => s + x.meters, 0);
  const totalEmitters = sectorList.reduce((s, x) => s + x.emitters, 0);
  const totalFlowM3h = (totalEmitters * emitterFlow) / 1000;
  const maxSectorM3h = sectorList.length ? Math.max(...sectorList.map((s) => s.flowM3h)) : 0;
  const exceedsPump = maxSectorM3h > pumpCapacity;
  const volumePerHourM3 = maxSectorM3h; // volume distributed in 1h of a single sector
  const mmEquivalent = plan.areaPlantable > 0 ? (volumePerHourM3 * 1000) / plan.areaPlantable : 0;

  return {
    assignments, sectors: sectorList,
    totalMeters, totalEmitters, totalFlowM3h,
    maxSectorM3h, exceedsPump,
    volumePerHourM3, mmEquivalent,
  };
}
