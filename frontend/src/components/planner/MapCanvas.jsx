import { useEffect, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import { TILE_LAYERS } from "@/lib/defaults";

/**
 * MapCanvas
 * - Stable Leaflet map inside a ref-controlled div (no React DOM manipulation).
 * - Renders: field vertices, field polygon, obstacles + buffers, rows, plants, network elements.
 * - Emits map events for tool-based interaction.
 */
export default function MapCanvas({
  tileLayerId,
  center,
  zoom,
  toolMode, // 'pan' | 'draw-field' | 'add-obstacle-point' | 'add-obstacle-poly' | 'add-network' | 'place-value'
  activeField,
  allFields,
  plan,
  showPlants,
  showRows,
  showBuffers,
  onMapClick,
  onVertexClick,
  onEdgeClick,
  onObstacleClick,
  onMapReady,
  networkKind, // active network element kind
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layersRef = useRef({
    otherFields: L.layerGroup(),
    activeField: L.layerGroup(),
    vertices: L.layerGroup(),
    obstacles: L.layerGroup(),
    buffers: L.layerGroup(),
    rows: L.layerGroup(),
    plants: L.layerGroup(),
    network: L.layerGroup(),
    plantable: L.layerGroup(),
  });

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: center || [40.4917, 17.9975],
      zoom: zoom || 16,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
      worldCopyJump: true,
      tap: true,
    });
    mapRef.current = map;
    // Add all layer groups
    Object.values(layersRef.current).forEach((lg) => lg.addTo(map));
    if (onMapReady) onMapReady(map);
    // Fix leaflet size after mount
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
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

  // Center and zoom control
  const centerKey = center ? `${center[0]},${center[1]}` : null;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    map.setView(center, zoom, { animate: true });
  }, [centerKey, zoom]);

  // Click handler
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  const toolModeRef = useRef(toolMode);
  useEffect(() => { toolModeRef.current = toolMode; }, [toolMode]);
  const networkKindRef = useRef(networkKind);
  useEffect(() => { networkKindRef.current = networkKind; }, [networkKind]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng, toolModeRef.current, networkKindRef.current);
      }
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, []);

  // Cursor style per tool
  useEffect(() => {
    if (!containerRef.current) return;
    const drawing = ["draw-field", "add-obstacle-point", "add-obstacle-poly", "add-network"].includes(toolMode);
    containerRef.current.style.cursor = drawing ? "crosshair" : "";
  }, [toolMode]);

  // Render all other fields (context)
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

  // Render active field polygon
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

  // Render vertex markers
  useEffect(() => {
    const lg = layersRef.current.vertices;
    lg.clearLayers();
    if (!activeField || !activeField.vertices) return;
    const smallStyle = activeField.closed;
    const size = smallStyle ? 12 : 18;
    activeField.vertices.forEach((v, idx) => {
      const iconClass = smallStyle ? "oliveto-vertex-small" : "oliveto-vertex";
      const html = `<div class="${iconClass}" style="width:${size}px;height:${size}px;"></div>`;
      const icon = L.divIcon({
        className: "vertex-icon-wrapper",
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([v.lat, v.lng], { icon, keyboard: false });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        if (onVertexClick) onVertexClick(v, idx);
      });
      marker.addTo(lg);
    });
  }, [activeField?.vertices, activeField?.closed, onVertexClick]);

  // Render obstacles + buffers
  useEffect(() => {
    const oLg = layersRef.current.obstacles;
    const bLg = layersRef.current.buffers;
    oLg.clearLayers();
    bLg.clearLayers();
    if (!activeField) return;
    // Buffers from plan
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
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (onObstacleClick) onObstacleClick(obs);
        });
        marker.addTo(oLg);
      } else if (obs.points.length >= 3) {
        const coords = obs.points.map((p) => [p.lat, p.lng]);
        const poly = L.polygon(coords, {
          color: "#ef4444",
          weight: 2,
          opacity: 0.9,
          fillColor: "#dc2626",
          fillOpacity: 0.28,
        });
        poly.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          if (onObstacleClick) onObstacleClick(obs);
        });
        poly.addTo(oLg);
      }
    }
  }, [activeField?.obstacles, plan?.obstacleBuffers, showBuffers, onObstacleClick]);

  // Render rows and plants
  useEffect(() => {
    const rLg = layersRef.current.rows;
    const pLg = layersRef.current.plants;
    rLg.clearLayers();
    pLg.clearLayers();
    if (!plan) return;
    if (showRows) {
      for (const row of plan.rows) {
        const color = row.isShort ? "#f59e0b" : "#e76f51";
        L.polyline([[row.start.lat, row.start.lng], [row.end.lat, row.end.lng]], {
          color,
          weight: row.isShort ? 1.5 : 2,
          opacity: 0.9,
          interactive: false,
        }).addTo(rLg);
      }
    }
    if (showPlants) {
      const map = mapRef.current;
      const z = map ? map.getZoom() : 16;
      const size = z >= 18 ? 6 : z >= 16 ? 4 : 3;
      for (const row of plan.rows) {
        for (const p of row.plants) {
          L.circleMarker([p.lat, p.lng], {
            radius: size / 2,
            color: "#052e16",
            weight: 1,
            fillColor: "#a7f3d0",
            fillOpacity: 1,
            interactive: false,
          }).addTo(pLg);
        }
      }
    }
  }, [plan, showPlants, showRows]);

  // Render network elements
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
