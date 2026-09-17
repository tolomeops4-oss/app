import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import MapCanvas from "@/components/planner/MapCanvas";
import TopBar from "@/components/planner/TopBar";
import Toolbar from "@/components/planner/Toolbar";
import FieldsDrawer from "@/components/planner/FieldsDrawer";
import SidePanel from "@/components/planner/SidePanel";
import { DEFAULT_CONFIG, DEFAULT_IRRIGATION, OBSTACLE_TYPES } from "@/lib/defaults";
import { generatePlan, optimizeAzimuth, computeIrrigation, polygonAreaM2, verticesToPolygon } from "@/lib/geometry";
import { exportGeoJSON, exportRowsCSV, exportPlantsCSV, exportPDF } from "@/lib/exportUtils";
import * as api from "@/lib/api";

export default function Planner() {
  const [fields, setFields] = useState([]);
  const [activeFieldId, setActiveFieldId] = useState(null);
  const [tileLayerId, setTileLayerId] = useState("google_hybrid");
  const [toolMode, setToolMode] = useState("pan");
  const [center, setCenter] = useState([40.4917, 17.9975]);
  const [zoom, setZoom] = useState(16);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showPlants, setShowPlants] = useState(true);
  const [showRows, setShowRows] = useState(true);
  const [showBuffers, setShowBuffers] = useState(true);
  const [loading, setLoading] = useState(true);
  const [drawingObstaclePoints, setDrawingObstaclePoints] = useState([]);
  const mapRef = useRef(null);
  const saveTimersRef = useRef({});
  const initLoadRef = useRef(false);

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
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeField = useMemo(() => fields.find((f) => f.id === activeFieldId), [fields, activeFieldId]);

  // Compute plan and irrigation
  const plan = useMemo(() => {
    if (!activeField || !activeField.closed || activeField.vertices.length < 3) return null;
    try { return generatePlan(activeField); } catch (e) { console.error(e); return null; }
  }, [activeField]);

  const irrigationResult = useMemo(() => {
    if (!plan || !activeField) return null;
    try { return computeIrrigation(plan, activeField.irrigation); } catch (e) { console.error(e); return null; }
  }, [plan, activeField?.irrigation]);

  // Enrich fields with area for drawer display
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

  // Update helpers
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

  // Keep a ref of fields for save
  const fieldsRef = useRef(fields);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);

  // ============ Tool handlers ============

  const handleMapClick = useCallback((latlng, mode, netKind) => {
    if (!activeField) return;
    if (mode === "draw-field") {
      if (activeField.closed) {
        toast.info("Campo già chiuso. Crea un nuovo campo per disegnare un altro perimetro.");
        return;
      }
      const v = { id: uuidv4(), lat: latlng.lat, lng: latlng.lng };
      updateFieldLocal(activeField.id, (f) => ({ vertices: [...f.vertices, v] }));
      scheduleSave(activeField.id);
    } else if (mode === "add-obstacle-point") {
      const info = OBSTACLE_TYPES[0];
      const obs = {
        id: uuidv4(),
        type: info.id,
        geomType: "point",
        points: [{ id: uuidv4(), lat: latlng.lat, lng: latlng.lng }],
        bufferAlong: info.along,
        bufferSide: info.side,
      };
      updateFieldLocal(activeField.id, (f) => ({ obstacles: [...(f.obstacles || []), obs] }));
      scheduleSave(activeField.id);
      toast.success("Ostacolo aggiunto");
    }
  }, [activeField, updateFieldLocal, scheduleSave]);

  const handleVertexClick = useCallback((vertex, idx) => {
    if (!activeField) return;
    if (!activeField.closed) {
      // Remove vertex during drawing
      updateFieldLocal(activeField.id, (f) => ({ vertices: f.vertices.filter((v) => v.id !== vertex.id) }));
      scheduleSave(activeField.id);
    } else {
      // Confirm delete or add-intermediate menu could go here; for now remove with confirm
      if (window.confirm("Eliminare questo vertice?")) {
        updateFieldLocal(activeField.id, (f) => ({ vertices: f.vertices.filter((v) => v.id !== vertex.id) }));
        scheduleSave(activeField.id);
      }
    }
  }, [activeField, updateFieldLocal, scheduleSave]);

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
    setPanelOpen(true);
    const poly = verticesToPolygon([...activeField.vertices]);
    const area = poly ? polygonAreaM2(poly) : 0;
    toast.success(`Campo chiuso: ${(area / 10000).toFixed(3)} ha`);
  }, [activeField, updateFieldLocal, scheduleSave]);

  const deleteActive = useCallback(() => {
    if (!activeField) return;
    if (!window.confirm(`Eliminare "${activeField.name}"?`)) return;
    handleDeleteField(activeField.id);
  }, [activeField]);

  const goToGPS = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocalizzazione non disponibile"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setZoom(18);
        toast.success("Centrato sulla tua posizione");
      },
      () => toast.error("Impossibile ottenere la posizione GPS"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const handleOptimize = useCallback((step) => {
    if (!activeField || !activeField.closed) { toast.error("Chiudi prima il campo"); return; }
    toast.info(`Ottimizzazione azimut (passo ${step}°) in corso...`);
    setTimeout(() => {
      try {
        const res = optimizeAzimuth(activeField, step);
        if (res) {
          updateFieldLocal(activeField.id, { azimuth: res.azimuth });
          scheduleSave(activeField.id);
          toast.success(`Azimut ottimale: ${res.azimuth}° (${res.plan.totalPlants} piante)`);
        } else {
          toast.error("Ottimizzazione fallita");
        }
      } catch (e) { toast.error("Errore ottimizzazione"); }
    }, 50);
  }, [activeField, updateFieldLocal, scheduleSave]);

  // ============ Field CRUD ============

  const handleCreateField = useCallback(async (name) => {
    try {
      const f = await api.createField(name);
      setFields((prev) => [...prev, f]);
      setActiveFieldId(f.id);
      setFieldsOpen(false);
      setToolMode("draw-field");
      toast.success(`Campo "${name}" creato. Tocca la mappa per posizionare i vertici.`);
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
      setFields((prev) => prev.filter((f) => f.id !== id));
      if (activeFieldId === id) {
        setActiveFieldId((prev) => {
          const remaining = fieldsRef.current.filter((f) => f.id !== id);
          return remaining[0]?.id || null;
        });
      }
      toast.success("Campo eliminato");
    } catch (e) { toast.error("Errore eliminazione"); }
  }, [activeFieldId]);

  const handleSelectField = useCallback((id) => {
    setActiveFieldId(id);
    // Center map on field
    const f = fields.find((x) => x.id === id);
    if (f && f.vertices.length >= 1) {
      const lat = f.vertices.reduce((s, v) => s + v.lat, 0) / f.vertices.length;
      const lng = f.vertices.reduce((s, v) => s + v.lng, 0) / f.vertices.length;
      setCenter([lat, lng]);
      setZoom(17);
    }
  }, [fields]);

  // ============ Config / Irrigation / Azimuth updates ============

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
    // Detect coordinates
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
    // Nominatim
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setZoom(15);
        toast.success(`Trovato: ${data[0].display_name.substring(0, 50)}`);
      } else {
        toast.error("Località non trovata");
      }
    } catch (e) { toast.error("Errore ricerca"); }
  }, []);

  const handleQuickLocation = useCallback((loc) => {
    setCenter([loc.lat, loc.lng]);
    setZoom(loc.zoom || 15);
  }, []);

  // ============ Exports ============

  const doExportPDF = useCallback(async () => {
    if (!activeField || !plan) return;
    toast.info("Generazione PDF in corso...");
    const mapEl = document.querySelector("[data-testid='leaflet-map']");
    try {
      await exportPDF({ field: activeField, plan, irrigationResult, mapElement: mapEl });
      toast.success("Report PDF generato");
    } catch (e) {
      console.error(e);
      toast.error("Errore generazione PDF");
    }
  }, [activeField, plan, irrigationResult]);

  // ============ Tool state helpers ============
  const canUndo = activeField && !activeField.closed && activeField.vertices.length > 0;
  const canClose = activeField && !activeField.closed && activeField.vertices.length >= 3;
  const canDelete = !!activeField;

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
        onMapClick={handleMapClick}
        onVertexClick={handleVertexClick}
        onMapReady={(m) => (mapRef.current = m)}
      />

      <TopBar
        activeField={activeField}
        fieldsCount={fields.length}
        tileLayerId={tileLayerId}
        onTileLayerChange={setTileLayerId}
        onOpenFields={() => setFieldsOpen(true)}
        onOpenPanel={() => setPanelOpen(true)}
        onSearch={handleSearch}
        onQuickLocation={handleQuickLocation}
      />

      <Toolbar
        toolMode={toolMode}
        onToolChange={async (mode) => {
          if (mode === "draw-field" && activeField && activeField.closed) {
            // Auto-create a new field for drawing
            try {
              const n = `Campo ${fields.length + 1}`;
              const f = await api.createField(n);
              setFields((prev) => [...prev, f]);
              setActiveFieldId(f.id);
              setToolMode("draw-field");
              toast.success(`Nuovo "${n}" — tocca la mappa per i vertici`);
              return;
            } catch (e) { toast.error("Errore nuovo campo"); return; }
          }
          setToolMode(mode);
        }}
        onUndoPoint={undoLastPoint}
        onCloseField={closeField}
        onDeleteField={deleteActive}
        onGPS={goToGPS}
        onOptimizeAzimuth={() => handleOptimize(5)}
        canUndo={canUndo}
        canClose={canClose}
        canDelete={canDelete}
      />

      {/* Live area indicator while drawing */}
      {activeField && !activeField.closed && activeField.vertices.length >= 2 && (
        <div className="fixed left-1/2 -translate-x-1/2 top-16 md:top-20 z-20 glass-panel rounded-full px-4 py-1.5 text-xs font-mono flex items-center gap-3" data-testid="live-perimeter-info">
          <span className="text-emerald-300">{activeField.vertices.length} vertici</span>
          {activeField.vertices.length >= 3 && (() => {
            const poly = verticesToPolygon(activeField.vertices);
            const area = poly ? polygonAreaM2(poly) : 0;
            return <span className="text-stone-300">≈ {(area / 10000).toFixed(3)} ha</span>;
          })()}
          <span className="text-stone-500 uppercase tracking-widest text-[10px]">Tocca "Chiudi" per salvare</span>
        </div>
      )}

      {/* Loading */}
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
        onFastOptimize={() => handleOptimize(5)}
        onFineOptimize={() => handleOptimize(1)}
        onRemoveObstacle={removeObstacle}
        onUpdateObstacle={updateObstacle}
        onExportGeoJSON={() => exportGeoJSON(activeField, plan)}
        onExportRowsCSV={() => exportRowsCSV(activeField, plan)}
        onExportPlantsCSV={() => exportPlantsCSV(activeField, plan)}
        onExportPDF={doExportPDF}
        showPlants={showPlants} setShowPlants={setShowPlants}
        showRows={showRows} setShowRows={setShowRows}
        showBuffers={showBuffers} setShowBuffers={setShowBuffers}
      />
    </>
  );
}
