// Geometric engine for Progetto Oliveto using Turf.js
// Convention: azimuth in degrees from North, clockwise (0° = North, 90° = East)
import * as turf from "@turf/turf";

// ---------- Basics ----------

export function verticesToPolygon(vertices) {
  if (!vertices || vertices.length < 3) return null;
  const coords = vertices.map((v) => [v.lng, v.lat]);
  coords.push([...coords[0]]);
  try { return turf.polygon([coords]); } catch (e) { return null; }
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
    let total = 0;
    if (line.features) for (const f of line.features) total += turf.length(f, { units: "meters" });
    return total;
  } catch (e) { return 0; }
}

// Normalize azimuth to [0, 360)
function norm360(a) { return ((a % 360) + 360) % 360; }
// Normalize azimuth for row direction (rows have no direction) to [0, 180)
function normRow(a) { const n = norm360(a); return n >= 180 ? n - 180 : n; }

// ---------- Obstacle asymmetric rectangle (row-oriented) ----------

export function obstacleToFeature(obstacle) {
  if (!obstacle || !obstacle.points || obstacle.points.length === 0) return null;
  if (obstacle.geomType === "point") {
    return turf.point([obstacle.points[0].lng, obstacle.points[0].lat]);
  }
  if (obstacle.points.length < 3) return turf.point([obstacle.points[0].lng, obstacle.points[0].lat]);
  const coords = obstacle.points.map((p) => [p.lng, p.lat]);
  coords.push([...coords[0]]);
  try { return turf.polygon([coords]); } catch (e) { return null; }
}

export function bufferObstacleRect(obstacle, azimuthDeg, alongM, sideM) {
  const feat = obstacleToFeature(obstacle);
  if (!feat) return null;
  const centroid = turf.centroid(feat);
  const rowBearing = norm360(azimuthDeg);
  const perpBearing = norm360(azimuthDeg + 90);
  // For polygons compute max extent along and perpendicular to row direction
  let extentAlong = 0;
  let extentSide = 0;
  if (feat.geometry.type === "Point") {
    // point → just alongM/sideM
    extentAlong = 0;
    extentSide = 0;
  } else {
    for (const ring of feat.geometry.coordinates) {
      for (const c of ring) {
        const p = turf.point(c);
        const d = turf.distance(centroid, p, { units: "meters" });
        if (d < 0.0001) continue;
        const b = norm360(turf.bearing(centroid, p));
        const along = Math.abs(d * Math.cos((b - rowBearing) * Math.PI / 180));
        const side = Math.abs(d * Math.cos((b - perpBearing) * Math.PI / 180));
        if (along > extentAlong) extentAlong = along;
        if (side > extentSide) extentSide = side;
      }
    }
  }
  const totalAlong = extentAlong + alongM;
  const totalSide = extentSide + sideM;
  // Build 4 corners around centroid using row/perp bearings
  const c1 = turf.destination(turf.destination(centroid, totalAlong, rowBearing, { units: "meters" }), totalSide, perpBearing, { units: "meters" });
  const c2 = turf.destination(turf.destination(centroid, totalAlong, rowBearing, { units: "meters" }), totalSide, norm360(perpBearing + 180), { units: "meters" });
  const c3 = turf.destination(turf.destination(centroid, totalAlong, norm360(rowBearing + 180), { units: "meters" }), totalSide, norm360(perpBearing + 180), { units: "meters" });
  const c4 = turf.destination(turf.destination(centroid, totalAlong, norm360(rowBearing + 180), { units: "meters" }), totalSide, perpBearing, { units: "meters" });
  return turf.polygon([[
    c1.geometry.coordinates, c2.geometry.coordinates, c3.geometry.coordinates, c4.geometry.coordinates, c1.geometry.coordinates,
  ]]);
}

// ---------- Row generation (bearing-based, geographic azimuth) ----------

function safeBuffer(poly, distMeters) {
  try { const b = turf.buffer(poly, distMeters, { units: "meters" }); return b || null; } catch (e) { return null; }
}

function safeDifference(a, b) {
  try {
    const fc = turf.featureCollection([a, b]);
    const d = turf.difference(fc);
    return d || null;
  } catch (e) {
    try { return turf.difference(a, b) || null; } catch (_) { return null; }
  }
}

function flattenCoords(polygon) {
  const out = [];
  const walk = (c) => {
    if (typeof c[0] === "number") out.push(c);
    else for (const x of c) walk(x);
  };
  walk(polygon.geometry.coordinates);
  return out;
}

function clipLineToPolygonMulti(line, polygon) {
  try {
    const split = turf.lineSplit(line, polygon);
    const segments = [];
    if (split && split.features) {
      for (const feat of split.features) {
        const coords = feat.geometry.coordinates;
        const midPt = turf.midpoint(turf.point(coords[0]), turf.point(coords[coords.length - 1]));
        if (turf.booleanPointInPolygon(midPt, polygon)) segments.push(feat);
      }
    }
    return segments;
  } catch (e) { return []; }
}

export function generatePlan(field) {
  const { vertices, obstacles = [], config, azimuth = 0 } = field;
  const { interRow, interPlant, headland, sideMargin, minSegment } = config;
  const fieldPoly = verticesToPolygon(vertices);
  if (!fieldPoly) return null;

  const areaGross = turf.area(fieldPoly);

  let plantablePoly = sideMargin > 0 ? safeBuffer(fieldPoly, -sideMargin) : fieldPoly;
  if (!plantablePoly) plantablePoly = fieldPoly;

  const obstacleBuffers = [];
  for (const obs of obstacles) {
    const buf = bufferObstacleRect(obs, azimuth, obs.bufferAlong, obs.bufferSide);
    if (!buf) continue;
    obstacleBuffers.push(buf);
    const diff = safeDifference(plantablePoly, buf);
    if (diff) plantablePoly = diff;
  }

  const areaPlantable = turf.area(plantablePoly);

  // Row direction = azimuth bearing (from North, clockwise)
  // Perpendicular direction = azimuth + 90
  const rowBearing = norm360(azimuth);
  const perpBearing = norm360(azimuth + 90);

  const centroid = turf.centroid(fieldPoly);
  const flat = flattenCoords(plantablePoly);
  if (flat.length === 0) {
    return {
      areaGross, areaPlantable, perimeter: polygonPerimeterM(fieldPoly),
      rows: [], plantablePolygon: plantablePoly, obstacleBuffers,
      totalPlants: 0, validRowCount: 0, shortRowCount: 0,
      totalRowMeters: 0, minRowLength: 0, maxRowLength: 0, avgRowLength: 0, density: 0,
    };
  }

  // Compute signed projections onto perpendicular direction (row spacing axis)
  const perpProjs = [];
  const alongProjs = [];
  for (const c of flat) {
    const p = turf.point(c);
    const d = turf.distance(centroid, p, { units: "meters" });
    if (d < 0.0001) { perpProjs.push(0); alongProjs.push(0); continue; }
    const b = norm360(turf.bearing(centroid, p));
    perpProjs.push(d * Math.cos((b - perpBearing) * Math.PI / 180));
    alongProjs.push(d * Math.cos((b - rowBearing) * Math.PI / 180));
  }
  const minPerp = Math.min(...perpProjs);
  const maxPerp = Math.max(...perpProjs);
  const minAlong = Math.min(...alongProjs);
  const maxAlong = Math.max(...alongProjs);
  const rowExtent = Math.max(Math.abs(minAlong), Math.abs(maxAlong)) + 200;

  const rows = [];
  const kStart = Math.ceil(minPerp / interRow);
  const kEnd = Math.floor(maxPerp / interRow);

  for (let k = kStart; k <= kEnd; k++) {
    const offsetM = k * interRow;
    const bearingForOffset = offsetM >= 0 ? perpBearing : norm360(perpBearing + 180);
    const rowCenter = Math.abs(offsetM) < 0.001
      ? centroid
      : turf.destination(centroid, Math.abs(offsetM), bearingForOffset, { units: "meters" });
    const startPt = turf.destination(rowCenter, rowExtent, norm360(rowBearing + 180), { units: "meters" });
    const endPt = turf.destination(rowCenter, rowExtent, rowBearing, { units: "meters" });
    const line = turf.lineString([startPt.geometry.coordinates, endPt.geometry.coordinates]);

    const segments = clipLineToPolygonMulti(line, plantablePoly);
    for (const seg of segments) {
      const segLenM = turf.length(seg, { units: "meters" });
      if (segLenM < 2 * headland + 0.1) continue;
      const startTrim = turf.along(seg, headland, { units: "meters" });
      const endTrim = turf.along(seg, segLenM - headland, { units: "meters" });
      const trimmed = turf.lineString([startTrim.geometry.coordinates, endTrim.geometry.coordinates]);
      const trimmedLen = turf.length(trimmed, { units: "meters" });
      if (trimmedLen < 0.5) continue;

      const plantsCoords = [];
      let d = 0;
      while (d <= trimmedLen + 0.001) {
        const pt = turf.along(trimmed, d, { units: "meters" });
        plantsCoords.push(pt.geometry.coordinates);
        d += interPlant;
      }
      const coords = trimmed.geometry.coordinates;
      const rid = `row-${k}-${rows.length}`;
      rows.push({
        id: rid,
        index: k,
        start: { lat: coords[0][1], lng: coords[0][0] },
        end: { lat: coords[1][1], lng: coords[1][0] },
        length: trimmedLen,
        isShort: trimmedLen < minSegment,
        plants: plantsCoords.map((c, i) => ({ id: `plant-${rid}-${i}`, lat: c[1], lng: c[0], rowId: rid })),
      });
    }
  }

  const totalPlants = rows.reduce((s, r) => s + r.plants.length, 0);
  const totalRowMeters = rows.reduce((s, r) => s + r.length, 0);
  const validRows = rows.filter((r) => !r.isShort);
  const shortRows = rows.filter((r) => r.isShort);
  const rowLengths = rows.map((r) => r.length);

  return {
    areaGross, areaPlantable,
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

// Azimuths of every edge (normalized to [0,180) — rows are directionless)
export function polygonEdgeAzimuths(vertices) {
  if (!vertices || vertices.length < 3) return [];
  const results = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const bearing = norm360(turf.bearing(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat])));
    const deg = normRow(bearing);
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

  const assignments = {};
  if (sectorMode === "manual") {
    for (const r of rows) {
      const s = manualAssignments?.[r.id];
      assignments[r.id] = typeof s === "number" ? s : 0;
    }
  } else {
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
  const volumePerHourM3 = maxSectorM3h;
  const mmEquivalent = plan.areaPlantable > 0 ? (volumePerHourM3 * 1000) / plan.areaPlantable : 0;

  return {
    assignments, sectors: sectorList,
    totalMeters, totalEmitters, totalFlowM3h,
    maxSectorM3h, exceedsPump,
    volumePerHourM3, mmEquivalent,
  };
}

// ---------- Snap helpers ----------

export function snapToNearestRow(latlng, plan, thresholdM = 8) {
  if (!plan?.rows || plan.rows.length === 0) return { snapped: false, lat: latlng.lat, lng: latlng.lng, rowId: null };
  const target = turf.point([latlng.lng, latlng.lat]);
  let best = null;
  for (const row of plan.rows) {
    // Check both endpoints (testata) — most common valve location
    for (const [end, isEnd] of [[row.start, false], [row.end, true]]) {
      const d = turf.distance(target, turf.point([end.lng, end.lat]), { units: "meters" });
      if (d <= thresholdM && (!best || d < best.d)) {
        best = { d, lat: end.lat, lng: end.lng, rowId: row.id, isEnd };
      }
    }
  }
  if (best) return { snapped: true, ...best };
  return { snapped: false, lat: latlng.lat, lng: latlng.lng, rowId: null };
}

// ---------- Measurement helpers ----------

export function pointsMetrics(points) {
  // points: [{id, lat, lng}]
  if (!points || points.length < 2) return { segments: [], totalM: 0, lastAzimuth: null, areaM2: null };
  const segments = [];
  let totalM = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = turf.point([points[i].lng, points[i].lat]);
    const b = turf.point([points[i + 1].lng, points[i + 1].lat]);
    const distM = turf.distance(a, b, { units: "meters" });
    const bearing = norm360(turf.bearing(a, b));
    segments.push({ distM, azimuth: bearing, aId: points[i].id, bId: points[i + 1].id });
    totalM += distM;
  }
  const lastSeg = segments[segments.length - 1];
  let areaM2 = null;
  if (points.length >= 3) {
    try {
      const coords = points.map((p) => [p.lng, p.lat]);
      coords.push([...coords[0]]);
      const poly = turf.polygon([coords]);
      areaM2 = turf.area(poly);
    } catch (e) { areaM2 = null; }
  }
  return { segments, totalM, lastAzimuth: lastSeg?.azimuth ?? null, areaM2 };
}
