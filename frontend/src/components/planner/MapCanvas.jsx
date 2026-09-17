import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { TILE_LAYERS } from "@/lib/defaults";

const PLANTS_MIN_ZOOM = 17; // auto-hide plants below this zoom

export default function MapCanvas({
  tileLayerId,
  center,
  zoom,
  toolMode,
  activeField,
  allFields,
  plan,
  showPlants,
  showRows,
  showBuffers,
  measurePoints,
  measureMetrics,
  onMapClick,
  onVertexClick,
  onVertexDragEnd,
  onEdgeMidpointClick,
  onObstacleClick,
  onMapReady,
  networkKind,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const [currentZoom, setCurrentZoom] = useState(zoom || 16);
  const layersRef = useRef({
    otherFields: L.layerGroup(),
    activeField: L.layerGroup(),
    vertices: L.layerGroup(),
    midpoints: L.layerGroup(),
    obstacles: L.layerGroup(),
    buffers: L.layerGroup(),
    rows: L.layerGroup(),
    plants: L.layerGroup(),
    network: L.layerGroup(),
    measure: L.layerGroup(),
  });

  const onMapClickRef = useRef(onMapClick);
  const toolModeRef = useRef(toolMode);
  const networkKindRef = useRef(networkKind);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { toolModeRef.current = toolMode; }, [toolMode]);
  useEffect(() => { networkKindRef.current = networkKind; }, [networkKind]);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: center || [40.4917, 17.9975],
      zoom: zoom || 16,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
      tapTolerance: 20,
    });
    mapRef.current = map;
    Object.values(layersRef.current).forEach((lg) => lg.addTo(map));

    const handleMapEvent = (e) => {
      const cb = onMapClickRef.current;
      if (cb) cb(e.latlng, toolModeRef.current, networkKindRef.current);
    };
    map.on("click", handleMapEvent);
    const handleZoom = () => setCurrentZoom(map.getZoom());
    map.on("zoomend", handleZoom);

    if (onMapReady) onMapReady(map);
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.off("click", handleMapEvent);
      map.off("zoomend", handleZoom);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tile layer switching
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tl = TILE_LAYERS.find((t) => t.id === tileLayerId) || TILE_LAYERS[0];
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(tl.url, {
      attribution: tl.attribution,
      maxZoom: tl.maxZoom,
      subdomains: tl.id === "osm" ? ["a", "b", "c"] : ["0", "1", "2", "3"],
    }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [tileLayerId]);

  const centerKey = center ? `${center[0]},${center[1]}` : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setView(center, zoom, { animate: true });
  }, [centerKey, zoom]);

  useEffect(() => {
    if (!containerRef.current) return;
    const drawing = ["draw-field", "add-obstacle-point", "measure"].includes(toolMode);
    containerRef.current.style.cursor = drawing ? "crosshair" : "";
  }, [toolMode]);

  // Measure layer
  useEffect(() => {
    const lg = layersRef.current.measure;
    lg.clearLayers();
    if (!measurePoints || measurePoints.length === 0) return;
    // Draw line
    if (measurePoints.length >= 2) {
      const coords = measurePoints.map((p) => [p.lat, p.lng]);
      L.polyline(coords, {
        color: "#f59e0b",
        weight: 3,
        opacity: 0.95,
        dashArray: "10,6",
        interactive: false,
      }).addTo(lg);
    }
    // Draw closing segment if >= 3 points (as area indication)
    if (measurePoints.length >= 3) {
      const first = measurePoints[0];
      const last = measurePoints[measurePoints.length - 1];
      L.polyline([[last.lat, last.lng], [first.lat, first.lng]], {
        color: "#f59e0b",
        weight: 1.5,
        opacity: 0.5,
        dashArray: "3,6",
        interactive: false,
      }).addTo(lg);
    }
    // Point markers
    measurePoints.forEach((p, i) => {
      const html = `<div style="background:#f59e0b;border:2px solid #fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:#451a03;font-weight:800;font-size:11px;font-family:JetBrains Mono,monospace;box-shadow:0 0 0 2px rgba(245,158,11,.35),0 2px 8px rgba(0,0,0,.5);">${i + 1}</div>`;
      const icon = L.divIcon({ className: "measure-icon", html, iconSize: [22, 22], iconAnchor: [11, 11] });
      L.marker([p.lat, p.lng], { icon, keyboard: false, interactive: false }).addTo(lg);
    });
    // Segment labels
    if (measureMetrics?.segments) {
      measureMetrics.segments.forEach((seg, i) => {
        const a = measurePoints[i];
        const b = measurePoints[i + 1];
        if (!a || !b) return;
        const midLat = (a.lat + b.lat) / 2;
        const midLng = (a.lng + b.lng) / 2;
        const html = `<div style="background:rgba(11,14,12,0.92);border:1px solid rgba(245,158,11,.6);border-radius:6px;padding:2px 6px;color:#fbbf24;font-family:JetBrains Mono,monospace;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.5);">${seg.distM.toFixed(2)} m</div>`;
        const icon = L.divIcon({ className: "measure-label", html, iconSize: null, iconAnchor: [0, 10] });
        L.marker([midLat, midLng], { icon, keyboard: false, interactive: false }).addTo(lg);
      });
    }
  }, [measurePoints, measureMetrics]);

  // Other fields
  useEffect(() => {
    const lg = layersRef.current.otherFields;
    lg.clearLayers();
    const activeId = activeField?.id;
    for (const f of allFields || []) {
      if (f.id === activeId) continue;
      if (!f.closed || f.vertices.length < 3) continue;
      const coords = f.vertices.map((v) => [v.lat, v.lng]);
      L.polygon(coords, {
        color: "#74c69d",
        weight: 1.5,
        opacity: 0.7,
        fillColor: "#2d6a4f",
        fillOpacity: 0.1,
        dashArray: "4,4",
        interactive: false,
      }).addTo(lg);
    }
  }, [allFields, activeField?.id]);

  // Active field polygon/polyline
  useEffect(() => {
    const lg = layersRef.current.activeField;
    lg.clearLayers();
    if (!activeField || !activeField.vertices || activeField.vertices.length === 0) return;
    if (activeField.vertices.length >= 2) {
      const coords = activeField.vertices.map((v) => [v.lat, v.lng]);
      if (activeField.closed && activeField.vertices.length >= 3) {
        L.polygon(coords, {
          color: "#38e07a",
          weight: 3,
          opacity: 1,
          fillColor: "#2d6a4f",
          fillOpacity: 0.18,
          interactive: false,
        }).addTo(lg);
      } else {
        L.polyline(coords, {
          color: "#38e07a",
          weight: 3,
          opacity: 0.95,
          dashArray: "8,6",
          interactive: false,
        }).addTo(lg);
      }
    }
  }, [activeField?.vertices, activeField?.closed]);

  // Vertex markers
  useEffect(() => {
    const lg = layersRef.current.vertices;
    lg.clearLayers();
    if (!activeField || !activeField.vertices) return;
    const drawing = !activeField.closed;
    const editing = toolMode === "edit-perimeter" && activeField.closed;
    const showLabels = drawing;
    const draggable = drawing || editing;

    activeField.vertices.forEach((v, idx) => {
      let size, iconClass, inner;
      if (showLabels) {
        size = 26;
        iconClass = "oliveto-vertex";
        inner = `<div class="${iconClass}" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;color:#052e16;font-weight:800;font-size:12px;font-family:JetBrains Mono,monospace;">${idx + 1}</div>`;
      } else if (editing) {
        size = 18;
        iconClass = "oliveto-vertex";
        inner = `<div class="${iconClass}" style="width:${size}px;height:${size}px;"></div>`;
      } else {
        size = 12;
        iconClass = "oliveto-vertex-small";
        inner = `<div class="${iconClass}" style="width:${size}px;height:${size}px;"></div>`;
      }
      const icon = L.divIcon({ className: "vertex-icon-wrapper", html: inner, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const marker = L.marker([v.lat, v.lng], { icon, keyboard: false, draggable });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onVertexClick) onVertexClick(v, idx);
      });
      if (draggable) {
        marker.on("dragend", (e) => {
          const { lat, lng } = e.target.getLatLng();
          if (onVertexDragEnd) onVertexDragEnd(v.id, lat, lng);
        });
      }
      marker.addTo(lg);
    });
  }, [activeField?.vertices, activeField?.closed, toolMode, onVertexClick, onVertexDragEnd]);

  // Midpoint markers (only during edit-perimeter)
  useEffect(() => {
    const lg = layersRef.current.midpoints;
    lg.clearLayers();
    if (toolMode !== "edit-perimeter" || !activeField?.closed || !activeField.vertices || activeField.vertices.length < 3) return;
    activeField.vertices.forEach((v, i) => {
      const next = activeField.vertices[(i + 1) % activeField.vertices.length];
      const midLat = (v.lat + next.lat) / 2;
      const midLng = (v.lng + next.lng) / 2;
      const html = `<div style="background:rgba(56,224,122,0.85);border:1.5px solid #052e16;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;color:#052e16;font-weight:900;font-size:13px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,.5);">+</div>`;
      const icon = L.divIcon({ className: "midpoint-icon", html, iconSize: [18, 18], iconAnchor: [9, 9] });
      const marker = L.marker([midLat, midLng], { icon, keyboard: false, opacity: 0.9 });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onEdgeMidpointClick) onEdgeMidpointClick(i, midLat, midLng);
      });
      marker.addTo(lg);
    });
  }, [activeField?.vertices, activeField?.closed, toolMode, onEdgeMidpointClick]);

  // Obstacles + buffers
  useEffect(() => {
    const oLg = layersRef.current.obstacles;
    const bLg = layersRef.current.buffers;
    oLg.clearLayers();
    bLg.clearLayers();
    if (!activeField) return;
    if (showBuffers && plan?.obstacleBuffers) {
      for (const buf of plan.obstacleBuffers) {
        const coords = buf.geometry.coordinates[0].map((c) => [c[1], c[0]]);
        L.polygon(coords, {
          color: "#f87171",
          weight: 1,
          opacity: 0.7,
          fillColor: "#ef4444",
          fillOpacity: 0.15,
          interactive: false,
          dashArray: "3,3",
        }).addTo(bLg);
      }
    }
    for (const obs of activeField.obstacles || []) {
      if (obs.geomType === "point" && obs.points[0]) {
        const p = obs.points[0];
        const html = `<div style="background:#ef4444;border:2px solid #fff;border-radius:50%;width:16px;height:16px;box-shadow:0 0 0 2px rgba(239,68,68,.35),0 2px 8px rgba(0,0,0,.5);"></div>`;
        const icon = L.divIcon({ className: "obstacle-icon", html, iconSize: [16, 16], iconAnchor: [8, 8] });
        const marker = L.marker([p.lat, p.lng], { icon });
        marker.on("click", (e) => { L.DomEvent.stopPropagation(e); if (onObstacleClick) onObstacleClick(obs); });
        marker.addTo(oLg);
      } else if (obs.points.length >= 3) {
        const coords = obs.points.map((p) => [p.lat, p.lng]);
        const poly = L.polygon(coords, { color: "#ef4444", weight: 2, opacity: 0.9, fillColor: "#dc2626", fillOpacity: 0.28 });
        poly.on("click", (e) => { L.DomEvent.stopPropagation(e); if (onObstacleClick) onObstacleClick(obs); });
        poly.addTo(oLg);
      }
    }
  }, [activeField?.obstacles, plan?.obstacleBuffers, showBuffers, onObstacleClick]);

  // Rows
  useEffect(() => {
    const rLg = layersRef.current.rows;
    rLg.clearLayers();
    if (!plan || !showRows) return;
    for (const row of plan.rows) {
      const color = row.isShort ? "#f59e0b" : "#e76f51";
      L.polyline([[row.start.lat, row.start.lng], [row.end.lat, row.end.lng]], {
        color,
        weight: row.isShort ? 1.5 : 2,
        opacity: 0.9,
        dashArray: row.isShort ? "6,4" : null,
        interactive: false,
      }).addTo(rLg);
    }
  }, [plan, showRows]);

  // Plants (auto-hide below min zoom)
  useEffect(() => {
    const pLg = layersRef.current.plants;
    pLg.clearLayers();
    if (!plan || !showPlants) return;
    if (currentZoom < PLANTS_MIN_ZOOM) return;
    const size = currentZoom >= 19 ? 4 : currentZoom >= 18 ? 3 : 2;
    for (const row of plan.rows) {
      for (const p of row.plants) {
        L.circleMarker([p.lat, p.lng], {
          radius: size,
          color: "#052e16",
          weight: 1,
          fillColor: "#a7f3d0",
          fillOpacity: 1,
          interactive: false,
        }).addTo(pLg);
      }
    }
  }, [plan, showPlants, currentZoom]);

  // Network
  useEffect(() => {
    const lg = layersRef.current.network;
    lg.clearLayers();
    if (!activeField?.networkElements) return;
    for (const el of activeField.networkElements) {
      const symbol = el.type === "pozzo" ? "◎" : el.type === "pompa" ? "⚙" : el.type === "filtro" ? "⌘" : "▣";
      const html = `<div class="oliveto-net-icon" style="width:32px;height:32px;">${symbol}</div>`;
      const icon = L.divIcon({ className: "net-icon-wrapper", html, iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker([el.lat, el.lng], { icon }).addTo(lg);
    }
  }, [activeField?.networkElements]);

  return <div ref={containerRef} className="absolute inset-0 z-0" data-testid="leaflet-map" />;
}

export { PLANTS_MIN_ZOOM };
