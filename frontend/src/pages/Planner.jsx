import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import MapCanvas from "@/components/planner/MapCanvas";
import TopBar from "@/components/planner/TopBar";
import Toolbar from "@/components/planner/Toolbar";
import FieldsDrawer from "@/components/planner/FieldsDrawer";
import SidePanel from "@/components/planner/SidePanel";
import ObstacleSheet from "@/components/planner/ObstacleSheet";
import NetworkSheet from "@/components/planner/NetworkSheet";
import MeasureBar from "@/components/planner/MeasureBar";
import EditPerimeterBar from "@/components/planner/EditPerimeterBar";
import { DEFAULT_CONFIG, DEFAULT_IRRIGATION } from "@/lib/defaults";
import { generatePlan, computeIrrigation, polygonAreaM2, verticesToPolygon, pointsMetrics, snapToNearestRow } from "@/lib/geometry";
import { exportGeoJSON, exportRowsCSV, exportPlantsCSV, exportPDF, parseGeoJSONForField, readFileAsText } from "@/lib/exportUtils";
import * as api from "@/lib/api";

export default function Planner() {
  const [fields, setFields] = useState([]);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [tileLayerId, setTileLayerId] = useState("google_hybrid");
  const [toolMode, setToolMode] = useState("pan");
  const [pendingObstacleType, setPendingObstacleType] = useState(null);
  const [obstacleSheetOpen, setObstacleSheetOpen] = useState(false);
  const [networkSheetOpen, setNetworkSheetOpen] = useState(false);
  const [pendingNetworkType, setPendingNetworkType] = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [center, setCenter] = useState([40.4917, 17.9975]);
  const [zoom, setZoom] = useState(16);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [initialPanelTab, setInitialPanelTab] = useState("config");
  const [showPlants, setShowPlants] = useState(true);
  const [showRows, setShowRows] = useState(true);
  const [showBuffers, setShowBuffers] = useState(true);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef(null);
  const saveTimersRef = useRef({});
  const initLoadRef = useRef(false);
  const fieldsRef = useRef(fields);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);

  // Load fields
  useEffect(() => {
    if (initLoadRef.current) return;
    initLoadRef.current = true;
    (async () => {
      try {
        const list = await api.listFields();
        if (list.length > 0) {
          setFields(list);
          setActiveFieldId(list[0].id);
        } else {
          const f = await api.createField("Campo 1");
          setFields([f]);
          setActiveFieldId(f.id);
        }
      } catch (e) {
        toast.error("Impossibile caricare i campi dal server");
      } finally { setLoading(false); }
    })();
  }, []);

  const activeField = useMemo(() => fields.find((f) => f.id === activeFieldId), [fields, activeFieldId]);

  const plan = useMemo(() => {
    if (!activeField || !activeField.closed || activeField.vertices.length < 3) return null;
    try { return generatePlan(activeField); } catch (e) { console.error(e); return null; }
  }, [activeField]);

  const irrigationResult = useMemo(() => {
    if (!plan || !activeField) return null;
    try { return computeIrrigation(plan, activeField.irrigation); } catch (e) { console.error(e); return null; }
  }, [plan, activeField?.irrigation]);

  const fieldsWithMeta = useMemo(() => fields.map((f) => {
    let ha = undefined;
    if (f.closed && f.vertices && f.vertices.length >= 3) {
      try {
        const poly = verticesToPolygon(f.vertices);
        ha = polygonAreaM2(poly) / 10000;
      } catch (e) {}
    }
    return { ...f, _areaHa: ha };
  }), [fields]);

  const updateFieldLocal = useCallback((id, patch) => {
    setFields((prev) => prev.map((f) => f.id === id ? { ...f, ...(typeof patch === "function" ? patch(f) : patch) } : f));
  }, []);

  const scheduleSave = useCallback((id) => {
    if (saveTimersRef.current[id]) clearTimeout(saveTimersRef.current[id]);
    saveTimersRef.current[id] = setTimeout(async () => {
      const f = fieldsRef.current.find((x) => x.id === id);
      if (!f) return;
      try {
        const payload = {
          name: f.name, vertices: f.vertices, closed: f.closed, obstacles: f.obstacles,
          config: f.config, irrigation: f.irrigation, networkElements: f.networkElements,
          azimuth: f.azimuth, tileLayer: f.tileLayer,
        };
        await api.updateField(id, payload);
      } catch (e) { /* silent */ }
    }, 600);
  }, []);

  // ============ Map click handler ============
  const handleMapClick = useCallback((latlng, mode) => {
    if (mode === "measure") {
      setMeasurePoints((prev) => [...prev, { id: uuidv4(), lat: latlng.lat, lng: latlng.lng }]);
      return;
    }
    if (!activeField) return;
    if (mode === "draw-field") {
      if (activeField.closed) {
        toast.info("Campo già chiuso. Usa 'Nuovo Campo' per crearne un altro.");
        return;
      }
      const v = { id: uuidv4(), lat: latlng.lat, lng: latlng.lng };
      updateFieldLocal(activeField.id, (f) => ({ vertices: [...f.vertices, v] }));
      scheduleSave(activeField.id);
    } else if (mode === "add-obstacle-point" && pendingObstacleType) {
      const t = pendingObstacleType;
      const obs = {
        id: uuidv4(),
        type: t.id,
        geomType: "point",
        points: [{ id: uuidv4(), lat: latlng.lat, lng: latlng.lng }],
        bufferAlong: t.along,
        bufferSide: t.side,
      };
      updateFieldLocal(activeField.id, (f) => ({ obstacles: [...(f.obstacles || []), obs] }));
      scheduleSave(activeField.id);
      toast.success(`Ostacolo "${t.label}" posizionato`);
    } else if (mode === "add-network" && pendingNetworkType) {
      const t = pendingNetworkType;
      // Snap to nearest filare endpoint if valvola
      let placedLat = latlng.lat, placedLng = latlng.lng, sectorIndex, snappedRowId;
      if (t.id === "valvola" && plan?.rows?.length) {
        const s = snapToNearestRow(latlng, plan, 12);
        if (s.snapped) {
          placedLat = s.lat; placedLng = s.lng; snappedRowId = s.rowId;
          if (irrigationResult?.assignments) {
            const si = irrigationResult.assignments[s.rowId];
            if (typeof si === "number") sectorIndex = si;
          }
        }
      }
      const el = {
        id: uuidv4(),
        type: t.id,
        lat: placedLat,
        lng: placedLng,
        label: t.label,
        sectorIndex,
        rowId: snappedRowId,
      };
      updateFieldLocal(activeField.id, (f) => ({ networkElements: [...(f.networkElements || []), el] }));
      scheduleSave(activeField.id);
      const suffix = t.id === "valvola" && snappedRowId ? ` (settore ${(sectorIndex ?? 0) + 1})` : "";
      toast.success(`${t.label} posizionato${suffix}`);
    }
  }, [activeField, updateFieldLocal, scheduleSave, pendingObstacleType, pendingNetworkType, plan, irrigationResult]);

  const handleVertexClick = useCallback((vertex) => {
    if (!activeField) return;
    if (!activeField.closed) {
      updateFieldLocal(activeField.id, (f) => ({ vertices: f.vertices.filter((v) => v.id !== vertex.id) }));
      scheduleSave(activeField.id);
    } else if (toolMode === "edit-perimeter") {
      // In edit mode: click on vertex removes it (need >= 3 remaining)
      if (activeField.vertices.length <= 3) {
        toast.error("Servono almeno 3 vertici");
        return;
      }
      if (window.confirm("Eliminare questo vertice?")) {
        updateFieldLocal(activeField.id, (f) => ({ vertices: f.vertices.filter((v) => v.id !== vertex.id) }));
      }
    }
  }, [activeField, updateFieldLocal, scheduleSave, toolMode]);

  const handleVertexDragEnd = useCallback((vid, lat, lng) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, (f) => ({
      vertices: f.vertices.map((v) => v.id === vid ? { ...v, lat, lng } : v),
    }));
    // Save only after finishing edit mode
    if (!activeField.closed) scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const handleEdgeMidpointClick = useCallback((edgeIndex, lat, lng) => {
    if (!activeField || toolMode !== "edit-perimeter") return;
    const newV = { id: uuidv4(), lat, lng };
    updateFieldLocal(activeField.id, (f) => {
      const arr = [...f.vertices];
      arr.splice(edgeIndex + 1, 0, newV);
      return { vertices: arr };
    });
    toast.success("Punto intermedio aggiunto");
  }, [activeField, updateFieldLocal, toolMode]);

  const undoLastPoint = useCallback(() => {
    if (!activeField || activeField.closed) return;
    updateFieldLocal(activeField.id, (f) => ({ vertices: f.vertices.slice(0, -1) }));
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const closeField = useCallback(() => {
    if (!activeField) return;
    if (activeField.vertices.length < 3) {
      toast.error("Servono almeno 3 vertici per chiudere il campo");
      return;
    }
    updateFieldLocal(activeField.id, { closed: true });
    scheduleSave(activeField.id);
    setToolMode("pan");
    setInitialPanelTab("config");
    setPanelOpen(true);
    const poly = verticesToPolygon([...activeField.vertices]);
    const area = poly ? polygonAreaM2(poly) : 0;
    toast.success(`Campo chiuso: ${(area / 10000).toFixed(3)} ha`);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const deleteActive = useCallback(() => {
    if (!activeField) return;
    if (!window.confirm(`Eliminare "${activeField.name}"?`)) return;
    handleDeleteField(activeField.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField]);

  const goToGPS = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocalizzazione non disponibile. Usa la ricerca coordinate (es. 40.49,17.99)");
      return;
    }
    toast.info("Ricerca posizione GPS...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setZoom(18);
        toast.success("Centrato sulla tua posizione");
      },
      () => toast.error("Impossibile ottenere GPS. Usa la ricerca coordinate."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // ============ Tool bar handler ============
  const handleToolChange = useCallback(async (mode) => {
    if (mode === "draw-field") {
      // If active field is closed or missing, create a new one for drawing
      if (!activeField || activeField.closed) {
        try {
          const n = `Campo ${fieldsRef.current.length + 1}`;
          const f = await api.createField(n);
          setFields((prev) => [...prev, f]);
          setActiveFieldId(f.id);
          setToolMode("draw-field");
          toast.success(`"${n}" — tocca la mappa per aggiungere vertici`);
          return;
        } catch (e) { toast.error("Errore nuovo campo"); return; }
      }
      setToolMode("draw-field");
      toast.info("Tocca la mappa per aggiungere vertici");
    } else if (mode === "add-obstacle-point") {
      if (!activeField || !activeField.closed) {
        toast.error("Prima chiudi il perimetro del campo");
        return;
      }
      setObstacleSheetOpen(true);
    } else if (mode === "add-network") {
      if (!activeField || !activeField.closed) {
        toast.error("Prima chiudi il perimetro del campo");
        return;
      }
      setNetworkSheetOpen(true);
    } else {
      setToolMode(mode);
      setPendingObstacleType(null);
      setPendingNetworkType(null);
    }
  }, [activeField]);

  const handleObstacleTypeSelected = useCallback((t) => {
    setPendingObstacleType(t);
    setPendingNetworkType(null);
    setToolMode("add-obstacle-point");
    setObstacleSheetOpen(false);
    toast.info(`${t.label} — tocca la mappa per posizionare`);
  }, []);

  const handleNetworkTypeSelected = useCallback((t) => {
    setPendingNetworkType(t);
    setPendingObstacleType(null);
    setToolMode("add-network");
    setNetworkSheetOpen(false);
    const hint = t.id === "valvola" ? "tocca vicino a un filare (snap 12m)" : "tocca la mappa per posizionare";
    toast.info(`${t.label} — ${hint}`);
  }, []);

  const handleNetworkElementClick = useCallback((el) => {
    if (!activeField) return;
    if (window.confirm(`Eliminare "${el.label}"?`)) {
      updateFieldLocal(activeField.id, (f) => ({ networkElements: f.networkElements.filter((x) => x.id !== el.id) }));
      scheduleSave(activeField.id);
    }
  }, [activeField, updateFieldLocal, scheduleSave]);

  const removeNetworkElement = useCallback((id) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, (f) => ({ networkElements: f.networkElements.filter((x) => x.id !== id) }));
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  // ============ Field CRUD ============
  const handleCreateField = useCallback(async (name) => {
    try {
      const f = await api.createField(name);
      setFields((prev) => [...prev, f]);
      setActiveFieldId(f.id);
      setFieldsOpen(false);
      setToolMode("draw-field");
      toast.success(`"${name}" creato. Tocca la mappa per i vertici.`);
    } catch (e) { toast.error("Errore creazione campo"); }
  }, []);

  const handleRenameField = useCallback(async (id, name) => {
    updateFieldLocal(id, { name });
    try { await api.updateField(id, { name }); } catch (e) {}
  }, [updateFieldLocal]);

  const handleDuplicateField = useCallback(async (id) => {
    try {
      const f = await api.duplicateField(id);
      setFields((prev) => [...prev, f]);
      toast.success(`Campo duplicato: "${f.name}"`);
    } catch (e) { toast.error("Errore duplicazione"); }
  }, []);

  const handleDeleteField = useCallback(async (id) => {
    try {
      await api.deleteField(id);
      const remaining = fieldsRef.current.filter((f) => f.id !== id);
      setFields(remaining);
      if (activeFieldId === id) setActiveFieldId(remaining[0]?.id || null);
      toast.success("Campo eliminato");
    } catch (e) { toast.error("Errore eliminazione"); }
  }, [activeFieldId]);

  const handleSelectField = useCallback((id) => {
    setActiveFieldId(id);
    const f = fields.find((x) => x.id === id);
    if (f && f.vertices.length >= 1) {
      const lat = f.vertices.reduce((s, v) => s + v.lat, 0) / f.vertices.length;
      const lng = f.vertices.reduce((s, v) => s + v.lng, 0) / f.vertices.length;
      setCenter([lat, lng]);
      setZoom(17);
    }
  }, [fields]);

  // ============ Edit perimeter ============
  const startEditPerimeter = useCallback((fid) => {
    const f = fieldsRef.current.find((x) => x.id === fid);
    if (!f || !f.closed) { toast.error("Il campo deve essere chiuso per essere modificato"); return; }
    setActiveFieldId(fid);
    setEditSnapshot(JSON.parse(JSON.stringify(f.vertices)));
    setToolMode("edit-perimeter");
    setFieldsOpen(false);
    // Center map on the field
    const lat = f.vertices.reduce((s, v) => s + v.lat, 0) / f.vertices.length;
    const lng = f.vertices.reduce((s, v) => s + v.lng, 0) / f.vertices.length;
    setCenter([lat, lng]);
    setZoom(17);
    toast.info("Trascina i vertici per modificarli. Tocca + tra due punti per aggiungerne uno.");
  }, []);

  const saveEditPerimeter = useCallback(() => {
    if (!activeField) return;
    if (activeField.vertices.length < 3) { toast.error("Servono almeno 3 vertici"); return; }
    scheduleSave(activeField.id);
    setEditSnapshot(null);
    setToolMode("pan");
    toast.success("Perimetro aggiornato");
  }, [activeField, scheduleSave]);

  const cancelEditPerimeter = useCallback(() => {
    if (!activeField || !editSnapshot) { setToolMode("pan"); setEditSnapshot(null); return; }
    updateFieldLocal(activeField.id, { vertices: editSnapshot });
    setEditSnapshot(null);
    setToolMode("pan");
    toast.info("Modifiche annullate");
  }, [activeField, editSnapshot, updateFieldLocal]);

  // ============ Measure tool ============
  const measureMetrics = useMemo(() => pointsMetrics(measurePoints), [measurePoints]);
  const startMeasure = useCallback(() => {
    if (toolMode === "measure") return;
    setToolMode("measure");
    setMeasurePoints([]);
    setPendingObstacleType(null);
    toast.info("Modalità Misura attiva. Tocca la mappa per posizionare i punti.");
  }, [toolMode]);
  const measureUndo = useCallback(() => {
    setMeasurePoints((prev) => prev.slice(0, -1));
  }, []);
  const measureClear = useCallback(() => setMeasurePoints([]), []);
  const measureExit = useCallback(() => {
    setMeasurePoints([]);
    setToolMode("pan");
  }, []);
  const measureUseAzimuth = useCallback((az) => {
    if (!activeField) return;
    const rowAz = ((az % 180) + 180) % 180;
    updateFieldLocal(activeField.id, { azimuth: rowAz });
    scheduleSave(activeField.id);
    toast.success(`Azimut filari impostato a ${rowAz.toFixed(1)}°`);
  }, [activeField, updateFieldLocal, scheduleSave]);

  // ============ Config / Irrigation / Azimuth ============
  const updateConfig = useCallback((patch) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, (f) => ({ config: { ...f.config, ...patch } }));
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const updateIrrigation = useCallback((patch) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, (f) => ({ irrigation: { ...f.irrigation, ...patch } }));
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const updateAzimuth = useCallback((az) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, { azimuth: az });
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const removeObstacle = useCallback((oid) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, (f) => ({ obstacles: f.obstacles.filter((o) => o.id !== oid) }));
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const updateObstacle = useCallback((oid, patch) => {
    if (!activeField) return;
    updateFieldLocal(activeField.id, (f) => ({ obstacles: f.obstacles.map((o) => o.id === oid ? { ...o, ...patch } : o) }));
    scheduleSave(activeField.id);
  }, [activeField, updateFieldLocal, scheduleSave]);

  // ============ Search / Quick locations ============
  const handleSearch = useCallback(async (q) => {
    const coordMatch = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setCenter([lat, lng]);
        setZoom(17);
        toast.success(`Coordinate: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setZoom(15);
        toast.success(`Trovato: ${data[0].display_name.substring(0, 50)}`);
      } else { toast.error("Località non trovata"); }
    } catch (e) { toast.error("Errore ricerca"); }
  }, []);

  const handleQuickLocation = useCallback((loc) => {
    setCenter([loc.lat, loc.lng]);
    setZoom(loc.zoom || 15);
  }, []);

  // ============ Import / Export ============
  const handleImportGeoJSON = useCallback(async (file) => {
    if (!activeField) return;
    try {
      const text = await readFileAsText(file);
      const gj = JSON.parse(text);
      const { vertices, obstacles } = parseGeoJSONForField(gj);
      updateFieldLocal(activeField.id, {
        vertices,
        obstacles,
        closed: true,
      });
      scheduleSave(activeField.id);
      toast.success(`GeoJSON importato: ${vertices.length} vertici, ${obstacles.length} ostacoli`);
      // Center map on imported field
      const lat = vertices.reduce((s, v) => s + v.lat, 0) / vertices.length;
      const lng = vertices.reduce((s, v) => s + v.lng, 0) / vertices.length;
      setCenter([lat, lng]);
      setZoom(17);
    } catch (e) {
      console.error(e);
      toast.error("Errore import: " + (e.message || "formato non valido"));
    }
  }, [activeField, updateFieldLocal, scheduleSave]);

  const doExportPDF = useCallback(async () => {
    if (!activeField || !plan) return;
    toast.info("Generazione PDF in corso...");
    const mapEl = document.querySelector("[data-testid='leaflet-map']");
    try {
      await exportPDF({ field: activeField, plan, irrigationResult, mapElement: mapEl });
      toast.success("Report PDF generato");
    } catch (e) { console.error(e); toast.error("Errore generazione PDF"); }
  }, [activeField, plan, irrigationResult]);

  // ============ Tool state ============
  const canUndo = activeField && !activeField.closed && activeField.vertices.length > 0;
  const canClose = activeField && !activeField.closed && activeField.vertices.length >= 3;
  const canDelete = !!activeField;

  // Live info
  const liveInfo = useMemo(() => {
    if (!activeField || activeField.closed || activeField.vertices.length < 1) return null;
    let ha = null;
    if (activeField.vertices.length >= 3) {
      const poly = verticesToPolygon(activeField.vertices);
      ha = poly ? polygonAreaM2(poly) / 10000 : null;
    }
    return { count: activeField.vertices.length, ha };
  }, [activeField?.vertices, activeField?.closed]);

  return (
    <>
      <MapCanvas
        tileLayerId={tileLayerId}
        center={center}
        zoom={zoom}
        toolMode={toolMode}
        activeField={activeField}
        allFields={fields}
        plan={plan}
        showPlants={showPlants}
        showRows={showRows}
        showBuffers={showBuffers}
        measurePoints={measurePoints}
        measureMetrics={measureMetrics}
        onMapClick={handleMapClick}
        onVertexClick={handleVertexClick}
        onVertexDragEnd={handleVertexDragEnd}
        onEdgeMidpointClick={handleEdgeMidpointClick}
        onNetworkElementClick={handleNetworkElementClick}
        onMapReady={(m) => (mapRef.current = m)}
      />

      <TopBar
        activeField={activeField}
        fieldsCount={fields.length}
        tileLayerId={tileLayerId}
        onTileLayerChange={setTileLayerId}
        onOpenFields={() => setFieldsOpen(true)}
        onOpenPanel={() => { setInitialPanelTab("config"); setPanelOpen(true); }}
        onSearch={handleSearch}
        onQuickLocation={handleQuickLocation}
      />

      <Toolbar
        toolMode={toolMode}
        onToolChange={handleToolChange}
        onUndoPoint={undoLastPoint}
        onCloseField={closeField}
        onDeleteField={deleteActive}
        onGPS={goToGPS}
        onOptimizeAzimuth={() => { setInitialPanelTab("orientation"); setPanelOpen(true); }}
        onMeasure={startMeasure}
        onNetwork={() => {
          if (!activeField || !activeField.closed) { toast.error("Prima chiudi il perimetro del campo"); return; }
          setNetworkSheetOpen(true);
        }}
        canUndo={canUndo}
        canClose={canClose}
        canDelete={canDelete}
      />

      {/* Drawing hint / live info */}
      {toolMode === "draw-field" && liveInfo && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 md:top-20 z-20 glass-panel rounded-full px-4 py-1.5 text-xs font-mono flex items-center gap-3" data-testid="live-perimeter-info">
          <span className="text-emerald-300 font-bold">Punti: {liveInfo.count}</span>
          {liveInfo.ha !== null && <span className="text-stone-300">≈ {liveInfo.ha.toFixed(3)} ha</span>}
          <span className="text-stone-500 uppercase tracking-widest text-[10px] hidden sm:inline">Tocca mappa · "Chiudi/Salva" per finalizzare</span>
        </div>
      )}
      {toolMode === "add-obstacle-point" && pendingObstacleType && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 md:top-20 z-20 glass-panel rounded-full px-4 py-1.5 text-xs font-mono flex items-center gap-2" data-testid="obstacle-placement-hint">
          <span className="text-red-400 font-bold">⚠ {pendingObstacleType.label}</span>
          <span className="text-stone-400">Tocca la mappa per posizionare</span>
        </div>
      )}
      {toolMode === "add-network" && pendingNetworkType && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 md:top-20 z-20 glass-panel rounded-full px-4 py-1.5 text-xs font-mono flex items-center gap-2" data-testid="network-placement-hint">
          <span className="text-sky-400 font-bold">💧 {pendingNetworkType.label}</span>
          <span className="text-stone-400">{pendingNetworkType.id === "valvola" ? "Tocca vicino a un filare (snap 12m)" : "Tocca la mappa per posizionare"}</span>
        </div>
      )}
      {toolMode === "edit-perimeter" && activeField && (() => {
        let ha = null;
        if (activeField.vertices.length >= 3) {
          const p = verticesToPolygon(activeField.vertices);
          if (p) ha = polygonAreaM2(p) / 10000;
        }
        return <EditPerimeterBar vertexCount={activeField.vertices.length} areaHa={ha} onSave={saveEditPerimeter} onCancel={cancelEditPerimeter} />;
      })()}

      {toolMode === "measure" && (
        <MeasureBar
          points={measurePoints}
          metrics={measureMetrics}
          onUndo={measureUndo}
          onClear={measureClear}
          onExit={measureExit}
          onUseAzimuth={measureUseAzimuth}
        />
      )}

      {/* Floating Parametri button */}
      {activeField && activeField.closed && toolMode !== "edit-perimeter" && toolMode !== "measure" && toolMode !== "add-network" && (
        <Button
          className="fixed right-3 md:right-6 bottom-24 md:bottom-28 z-20 h-14 w-14 md:h-16 md:w-16 rounded-full glass-panel bg-emerald-600/95 hover:bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 border border-emerald-400/50 p-0 flex flex-col gap-0.5 items-center justify-center"
          onClick={() => { setInitialPanelTab("config"); setPanelOpen(true); }}
          data-testid="btn-floating-params"
          title="Parametri Impianto"
        >
          <Settings2 className="w-5 h-5 md:w-6 md:h-6" />
          <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-wider leading-none">Param.</span>
        </Button>
      )}

      {loading && (
        <div className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-emerald-300 font-mono text-sm animate-pulse">Caricamento Progetto Oliveto...</div>
        </div>
      )}

      <FieldsDrawer
        open={fieldsOpen}
        onOpenChange={setFieldsOpen}
        fields={fieldsWithMeta}
        activeFieldId={activeFieldId}
        onSelect={handleSelectField}
        onCreate={handleCreateField}
        onRename={handleRenameField}
        onDuplicate={handleDuplicateField}
        onDelete={handleDeleteField}
        onEditPerimeter={startEditPerimeter}
      />

      <SidePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        field={activeField}
        plan={plan}
        irrigationResult={irrigationResult}
        onUpdateConfig={updateConfig}
        onUpdateIrrigation={updateIrrigation}
        onUpdateAzimuth={updateAzimuth}
        onRemoveObstacle={removeObstacle}
        onUpdateObstacle={updateObstacle}
        onRemoveNetworkElement={removeNetworkElement}
        onExportGeoJSON={() => exportGeoJSON(activeField, plan)}
        onExportRowsCSV={() => exportRowsCSV(activeField, plan)}
        onExportPlantsCSV={() => exportPlantsCSV(activeField, plan)}
        onExportPDF={doExportPDF}
        onImportGeoJSON={handleImportGeoJSON}
        showPlants={showPlants} setShowPlants={setShowPlants}
        showRows={showRows} setShowRows={setShowRows}
        showBuffers={showBuffers} setShowBuffers={setShowBuffers}
        initialTab={initialPanelTab}
      />

      <ObstacleSheet
        open={obstacleSheetOpen}
        onOpenChange={setObstacleSheetOpen}
        onSelectType={handleObstacleTypeSelected}
      />

      <NetworkSheet
        open={networkSheetOpen}
        onOpenChange={setNetworkSheetOpen}
        onSelectType={handleNetworkTypeSelected}
      />
    </>
  );
}
