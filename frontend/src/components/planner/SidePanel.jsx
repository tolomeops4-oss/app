import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings2, Droplets, BarChart3, ShieldAlert, Download, FileJson, FileText, Table, Trash2, Radar } from "lucide-react";
import AzimuthCompass from "./AzimuthCompass";
import { VARIETIES, OBSTACLE_TYPES } from "@/lib/defaults";

function NumberField({ label, value, onChange, min, max, step, unit, testId, hint }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">{label}</Label>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(v);
            }}
            className="w-20 h-7 text-xs font-mono text-emerald-300 bg-stone-900/70 border-stone-700 text-right"
            data-testid={testId}
          />
          <span className="text-[10px] text-stone-500 font-mono w-6">{unit}</span>
        </div>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
      {hint && <div className="text-[10px] text-stone-500 italic">{hint}</div>}
    </div>
  );
}

function MetricCard({ label, value, unit, accent }) {
  return (
    <div className="rounded-xl border border-stone-800 bg-stone-950/40 p-3">
      <div className="text-[10px] uppercase tracking-widest text-stone-500 font-semibold">{label}</div>
      <div className={`font-mono font-bold text-lg mt-0.5 ${accent || "text-emerald-300"}`}>{value}</div>
      {unit && <div className="text-[10px] text-stone-500 mt-0.5">{unit}</div>}
    </div>
  );
}

export default function SidePanel({
  open, onOpenChange, field, plan, irrigationResult,
  onUpdateConfig, onUpdateIrrigation, onUpdateAzimuth,
  onFineOptimize, onFastOptimize,
  onRemoveObstacle, onUpdateObstacle,
  onExportGeoJSON, onExportRowsCSV, onExportPlantsCSV, onExportPDF,
  showPlants, setShowPlants, showRows, setShowRows, showBuffers, setShowBuffers,
}) {
  const [tab, setTab] = useState("config");

  if (!field) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="glass-panel border-l border-stone-800 text-stone-100 w-full sm:max-w-md p-6">
          <div className="text-center text-stone-500 py-20">Nessun campo selezionato.</div>
        </SheetContent>
      </Sheet>
    );
  }

  const cfg = field.config;
  const irr = field.irrigation;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="glass-panel border-l border-stone-800 text-stone-100 w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-2 border-b border-stone-800/70">
          <SheetTitle className="text-emerald-300 font-bold text-lg tracking-tight">{field.name}</SheetTitle>
          <p className="text-xs text-stone-400 font-mono">
            {plan ? `${(plan.areaGross / 10000).toFixed(3)} ha lorda · ${(plan.areaPlantable / 10000).toFixed(3)} ha impiantabile` : "Campo non chiuso"}
          </p>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-4 mx-4 mt-3 bg-stone-900/60 border border-stone-800 rounded-xl h-10 p-0.5">
            <TabsTrigger value="config" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="tab-config">
              <Settings2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Sesto</span>
            </TabsTrigger>
            <TabsTrigger value="obstacles" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="tab-obstacles">
              <ShieldAlert className="w-3.5 h-3.5" /><span className="hidden sm:inline">Ostacoli</span>
            </TabsTrigger>
            <TabsTrigger value="irrigation" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="tab-irrigation">
              <Droplets className="w-3.5 h-3.5" /><span className="hidden sm:inline">Irrigaz.</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="tab-results">
              <BarChart3 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Risultati</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto thin-scrollbar px-5 py-4">
            {/* CONFIG */}
            <TabsContent value="config" className="space-y-5 mt-0">
              <AzimuthCompass
                azimuth={field.azimuth}
                onChange={onUpdateAzimuth}
                plantsCount={plan?.totalPlants}
                avgLen={plan?.avgRowLength}
              />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={onFastOptimize} className="bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/50 text-xs gap-1 h-9" data-testid="btn-fast-optimize">
                  <Radar className="w-3.5 h-3.5" /> Scan 5° veloce
                </Button>
                <Button variant="outline" size="sm" onClick={onFineOptimize} className="bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50 text-xs gap-1 h-9" data-testid="btn-fine-optimize">
                  <Radar className="w-3.5 h-3.5" /> Scan 1° fine
                </Button>
              </div>

              <div className="pt-2 space-y-4">
                <NumberField label="Distanza tra file (interfilare)" value={cfg.interRow} onChange={(v) => onUpdateConfig({ interRow: v })} min={2.5} max={7.0} step={0.1} unit="m" testId="input-inter-row" hint="Range consigliato 3.5 - 4.5 m per superintensivo" />
                <NumberField label="Distanza tra piante sulla fila" value={cfg.interPlant} onChange={(v) => onUpdateConfig({ interPlant: v })} min={0.8} max={3.0} step={0.1} unit="m" testId="input-inter-plant" />
                <NumberField label="Capezzagna di testata (lungo fila)" value={cfg.headland} onChange={(v) => onUpdateConfig({ headland: v })} min={4} max={25} step={0.5} unit="m" testId="input-headland" />
                <NumberField label="Margine laterale (parallelo alle file)" value={cfg.sideMargin} onChange={(v) => onUpdateConfig({ sideMargin: v })} min={1} max={10} step={0.5} unit="m" testId="input-side-margin" />
                <NumberField label="Lunghezza minima filare accettabile" value={cfg.minSegment} onChange={(v) => onUpdateConfig({ minSegment: v })} min={5} max={80} step={1} unit="m" testId="input-min-segment" hint="Filari più corti verranno segnalati in arancione" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Varietà</Label>
                  <Select value={cfg.variety} onValueChange={(v) => onUpdateConfig({ variety: v })}>
                    <SelectTrigger className="bg-stone-900/70 border-stone-700 h-9 text-sm" data-testid="select-variety"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel border-stone-700 text-stone-100">
                      {VARIETIES.map((v) => <SelectItem key={v} value={v} className="focus:bg-emerald-900/40">{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-800 space-y-2">
                <div className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Visualizzazione</div>
                <div className="flex items-center justify-between text-xs">
                  <span>Mostra filari</span>
                  <Switch checked={showRows} onCheckedChange={setShowRows} data-testid="switch-show-rows" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Mostra piante</span>
                  <Switch checked={showPlants} onCheckedChange={setShowPlants} data-testid="switch-show-plants" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Mostra buffer ostacoli</span>
                  <Switch checked={showBuffers} onCheckedChange={setShowBuffers} data-testid="switch-show-buffers" />
                </div>
              </div>
            </TabsContent>

            {/* OSTACOLI */}
            <TabsContent value="obstacles" className="space-y-3 mt-0">
              <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 p-3 text-xs text-emerald-200/80">
                Attiva "Ostacolo" nella barra strumenti e tocca la mappa per posizionare. I filari verranno interrotti dalla fascia di rispetto.
              </div>
              {(field.obstacles || []).length === 0 && <div className="text-center text-stone-500 text-sm py-10">Nessun ostacolo tracciato.</div>}
              {(field.obstacles || []).map((obs) => {
                const typeInfo = OBSTACLE_TYPES.find((t) => t.id === obs.type);
                return (
                  <div key={obs.id} className="rounded-xl border border-red-900/50 bg-red-950/20 p-3 space-y-2" data-testid={`obstacle-item-${obs.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                        <Select value={obs.type} onValueChange={(v) => {
                          const info = OBSTACLE_TYPES.find((t) => t.id === v);
                          onUpdateObstacle(obs.id, { type: v, bufferAlong: info?.along || obs.bufferAlong, bufferSide: info?.side || obs.bufferSide });
                        }}>
                          <SelectTrigger className="bg-stone-900 border-stone-700 h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                          <SelectContent className="glass-panel border-stone-700 text-stone-100">
                            {OBSTACLE_TYPES.map((t) => <SelectItem key={t.id} value={t.id} className="focus:bg-emerald-900/40 text-xs">{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:bg-red-950/40" onClick={() => onRemoveObstacle(obs.id)} data-testid={`btn-remove-obstacle-${obs.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] uppercase tracking-widest text-stone-500">Buffer lungo fila</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input type="number" value={obs.bufferAlong} step={0.5} min={0} onChange={(e) => onUpdateObstacle(obs.id, { bufferAlong: parseFloat(e.target.value) || 0 })} className="h-7 bg-stone-900 border-stone-700 text-xs font-mono text-emerald-300 text-right" data-testid={`input-obs-along-${obs.id}`} />
                          <span className="text-[10px] text-stone-500 font-mono">m</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-widest text-stone-500">Buffer laterale</Label>
                        <div className="flex items-center gap-1 mt-1">
                          <Input type="number" value={obs.bufferSide} step={0.5} min={0} onChange={(e) => onUpdateObstacle(obs.id, { bufferSide: parseFloat(e.target.value) || 0 })} className="h-7 bg-stone-900 border-stone-700 text-xs font-mono text-emerald-300 text-right" data-testid={`input-obs-side-${obs.id}`} />
                          <span className="text-[10px] text-stone-500 font-mono">m</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] text-stone-500 font-mono">{obs.geomType === "point" ? "Punto" : `Poligono ${obs.points.length} vert.`}</div>
                  </div>
                );
              })}
            </TabsContent>

            {/* IRRIGATION */}
            <TabsContent value="irrigation" className="space-y-4 mt-0">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Ali per fila</Label>
                  <Select value={String(irr.linesPerRow)} onValueChange={(v) => onUpdateIrrigation({ linesPerRow: parseInt(v) })}>
                    <SelectTrigger className="bg-stone-900/70 border-stone-700 h-9 text-sm" data-testid="select-lines-per-row"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel border-stone-700 text-stone-100">
                      <SelectItem value="1" className="focus:bg-emerald-900/40">1 ala</SelectItem>
                      <SelectItem value="2" className="focus:bg-emerald-900/40">2 ali</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField label="Portata gocciolatore" value={irr.emitterFlow} onChange={(v) => onUpdateIrrigation({ emitterFlow: v })} min={0.6} max={4.0} step={0.1} unit="L/h" testId="input-emitter-flow" />
                <NumberField label="Passo gocciolatori" value={irr.emitterSpacing} onChange={(v) => onUpdateIrrigation({ emitterSpacing: v })} min={0.2} max={2.0} step={0.05} unit="m" testId="input-emitter-spacing" />
                <NumberField label="Pressione nominale" value={irr.pressure} onChange={(v) => onUpdateIrrigation({ pressure: v })} min={0.5} max={3.5} step={0.1} unit="bar" testId="input-pressure" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Tipo ala gocciolante</Label>
                  <Select value={irr.pipeType} onValueChange={(v) => onUpdateIrrigation({ pipeType: v })}>
                    <SelectTrigger className="bg-stone-900/70 border-stone-700 h-9 text-sm" data-testid="select-pipe-type"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel border-stone-700 text-stone-100">
                      <SelectItem value="PC" className="focus:bg-emerald-900/40">Autocompensante (PC)</SelectItem>
                      <SelectItem value="NON_PC" className="focus:bg-emerald-900/40">Non compensante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField label="Portata pompa dichiarata" value={irr.pumpCapacity} onChange={(v) => onUpdateIrrigation({ pumpCapacity: v })} min={2} max={200} step={1} unit="m³/h" testId="input-pump-capacity" />
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-widest text-stone-400 font-semibold">Modalità settori</Label>
                  <Select value={irr.sectorMode} onValueChange={(v) => onUpdateIrrigation({ sectorMode: v })}>
                    <SelectTrigger className="bg-stone-900/70 border-stone-700 h-9 text-sm" data-testid="select-sector-mode"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel border-stone-700 text-stone-100">
                      <SelectItem value="auto" className="focus:bg-emerald-900/40">Automatica</SelectItem>
                      <SelectItem value="manual" className="focus:bg-emerald-900/40">Manuale (per filare)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <NumberField label="Numero settori" value={irr.numSectors} onChange={(v) => onUpdateIrrigation({ numSectors: Math.round(v) })} min={1} max={12} step={1} unit="#" testId="input-num-sectors" />
              </div>

              {irrigationResult && (
                <div className="pt-3 border-t border-stone-800 space-y-2">
                  <div className="text-[11px] uppercase tracking-widest text-emerald-300 font-semibold">Riepilogo Idraulico</div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Metri ala" value={irrigationResult.totalMeters.toFixed(0)} unit="m" />
                    <MetricCard label="Gocciolatori" value={irrigationResult.totalEmitters.toLocaleString("it-IT")} unit="unità" />
                    <MetricCard label="Portata totale" value={irrigationResult.totalFlowM3h.toFixed(2)} unit="m³/h" />
                    <MetricCard label="Portata max settore" value={irrigationResult.maxSectorM3h.toFixed(2)} unit="m³/h" accent={irrigationResult.exceedsPump ? "text-red-400" : "text-emerald-300"} />
                    <MetricCard label="Volume 1h/settore" value={irrigationResult.volumePerHourM3.toFixed(2)} unit="m³" />
                    <MetricCard label="Pioggia equivalente" value={irrigationResult.mmEquivalent.toFixed(2)} unit="mm/h" />
                  </div>
                  {irrigationResult.exceedsPump && (
                    <div className="rounded-lg border border-red-700/50 bg-red-950/40 p-2.5 text-[11px] text-red-300" data-testid="alert-pump-exceeded">
                      ⚠ La portata massima di settore supera la capacità dichiarata della pompa ({irr.pumpCapacity} m³/h). Aumenta il numero di settori o riduci la portata gocciolatore.
                    </div>
                  )}
                  <div className="rounded-xl border border-stone-800 bg-stone-950/40 overflow-hidden">
                    <div className="grid grid-cols-4 text-[10px] uppercase tracking-widest text-stone-500 font-semibold px-3 py-1.5 border-b border-stone-800">
                      <span>Settore</span><span>Filari</span><span>Metri</span><span>m³/h</span>
                    </div>
                    {irrigationResult.sectors.map((s) => (
                      <div key={s.index} className="grid grid-cols-4 text-xs font-mono px-3 py-1.5 border-b border-stone-800/60 last:border-b-0" data-testid={`sector-row-${s.index}`}>
                        <span className="text-emerald-300 font-bold">#{s.index + 1}</span>
                        <span>{s.rows}</span>
                        <span>{s.meters.toFixed(0)}</span>
                        <span>{s.flowM3h.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* RESULTS */}
            <TabsContent value="results" className="space-y-4 mt-0">
              {!plan ? (
                <div className="text-center text-stone-500 py-16 text-sm">Chiudi il campo per calcolare filari e risultati.</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricCard label="Superficie lorda" value={(plan.areaGross / 10000).toFixed(3)} unit="ha" />
                    <MetricCard label="Superficie impiantabile" value={(plan.areaPlantable / 10000).toFixed(3)} unit="ha" />
                    <MetricCard label="Perimetro" value={plan.perimeter.toFixed(0)} unit="m" />
                    <MetricCard label="Filari totali" value={plan.rows.length} unit={`${plan.shortRowCount} corti`} />
                    <MetricCard label="Metri lineari filari" value={plan.totalRowMeters.toFixed(0)} unit="m" />
                    <MetricCard label="Piante totali" value={plan.totalPlants.toLocaleString("it-IT")} unit="piante" />
                    <MetricCard label="Densità reale" value={plan.density.toFixed(0)} unit="piante/ha" />
                    <MetricCard label="Filari validi" value={plan.validRowCount} unit="≥ min segmento" />
                    <MetricCard label="Lunghezza media" value={plan.avgRowLength.toFixed(1)} unit="m" />
                    <MetricCard label="Min / Max filare" value={`${plan.minRowLength.toFixed(0)} / ${plan.maxRowLength.toFixed(0)}`} unit="m" />
                  </div>

                  <div className="pt-2 border-t border-stone-800 space-y-2">
                    <div className="text-[11px] uppercase tracking-widest text-emerald-300 font-semibold flex items-center gap-2"><Download className="w-3.5 h-3.5" />Esportazioni</div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={onExportGeoJSON} className="bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40 text-stone-200 gap-1 text-xs h-9" data-testid="btn-export-geojson">
                        <FileJson className="w-3.5 h-3.5" /> GeoJSON
                      </Button>
                      <Button variant="outline" size="sm" onClick={onExportRowsCSV} className="bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40 text-stone-200 gap-1 text-xs h-9" data-testid="btn-export-rows-csv">
                        <Table className="w-3.5 h-3.5" /> CSV Filari
                      </Button>
                      <Button variant="outline" size="sm" onClick={onExportPlantsCSV} className="bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40 text-stone-200 gap-1 text-xs h-9" data-testid="btn-export-plants-csv">
                        <Table className="w-3.5 h-3.5" /> CSV Piante
                      </Button>
                      <Button variant="default" size="sm" onClick={onExportPDF} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs h-9" data-testid="btn-export-pdf">
                        <FileText className="w-3.5 h-3.5" /> Report PDF
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
