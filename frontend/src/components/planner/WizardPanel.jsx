import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, Plus, Minus, Pencil, Undo2, CheckCircle2, Ruler, Sparkles, AlertTriangle, FileText, Save, Share2, ChevronUp, ChevronDown, Radar } from "lucide-react";
import { VARIETIES } from "@/lib/defaults";
import { optimizeAzimuth } from "@/lib/geometry";
import { toast } from "sonner";

function QuickBig({ value, onChange, min, max, step, unit, testId }) {
  const nudge = (d) => onChange(Math.max(min, Math.min(max, +(value + d).toFixed(2))));
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => nudge(-step)} className="h-10 w-10 rounded-xl bg-stone-900 border border-stone-700 hover:bg-emerald-950/40 text-stone-100 flex items-center justify-center" data-testid={`${testId}-minus`}>
        <Minus className="w-4 h-4" />
      </button>
      <div className="flex-1 text-center bg-stone-950/60 border border-stone-800 rounded-xl h-10 flex items-center justify-center gap-1">
        <span className="font-mono text-lg font-bold text-emerald-300" data-testid={testId}>{value.toFixed(step < 0.5 ? 2 : 1)}</span>
        <span className="text-[10px] text-stone-500 font-mono">{unit}</span>
      </div>
      <button onClick={() => nudge(step)} className="h-10 w-10 rounded-xl bg-stone-900 border border-stone-700 hover:bg-emerald-950/40 text-stone-100 flex items-center justify-center" data-testid={`${testId}-plus`}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function KV({ label, value, unit, accent }) {
  return (
    <div className="text-center bg-stone-950/40 border border-stone-800 rounded-xl px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-stone-500 font-semibold leading-tight">{label}</div>
      <div className={`font-mono font-bold text-sm ${accent || "text-emerald-300"} leading-tight mt-0.5`}>{value}</div>
      {unit && <div className="text-[9px] text-stone-500 leading-tight">{unit}</div>}
    </div>
  );
}

export default function WizardPanel({
  step, onStepChange, field, plan, irrigationResult,
  onDrawStart, onUndo, onCloseField, onMeasure,
  onUpdateConfig, onUpdateIrrigation, onUpdateAzimuth,
  onAddObstacle, onExportPDF, onExportGeoJSON, onFlushSave,
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (!field) return null;
  const isClosed = field.closed && field.vertices.length >= 3;
  const unlockedUpTo = isClosed ? 5 : 1;

  const areaHa = plan ? plan.areaGross / 10000 : 0;
  const perimeter = plan ? plan.perimeter : 0;
  const teoPiante = plan ? Math.floor((areaHa * 10000) / (field.config.interRow * field.config.interPlant)) : 0;

  const canNext = step < 5 && (step === 1 ? isClosed : true);
  const nextLabel = step === 1 ? "Avanti: Sesto" : step === 2 ? "Avanti: Capezzagne" : step === 3 ? "Avanti: Orientamento" : step === 4 ? "Avanti: Irrigazione" : "";

  const runOptimize = () => {
    if (!isClosed) return;
    toast.info("Ottimizzazione in corso...");
    setTimeout(() => {
      const r = optimizeAzimuth(field, 1);
      if (r) {
        onUpdateAzimuth(r.azimuth);
        toast.success(`Orientamento ottimale: ${r.azimuth}° (${r.plan.totalPlants} piante)`);
      } else toast.error("Ottimizzazione fallita");
    }, 20);
  };

  return (
    <div className="fixed left-2 right-2 md:left-4 md:right-4 bottom-2 md:bottom-4 z-30" data-testid="wizard-panel">
      <div className="glass-panel rounded-2xl overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-stone-800/70">
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="text-[10px] uppercase tracking-widest font-bold">Step {step} / 5</span>
            <span className="text-xs font-semibold">
              {step === 1 ? "Traccia Confini" : step === 2 ? "Sesto d'Impianto" : step === 3 ? "Capezzagne & Ostacoli" : step === 4 ? "Orientamento File" : "Irrigazione & Report"}
            </span>
          </div>
          <button onClick={() => setCollapsed((c) => !c)} className="text-stone-400 hover:text-emerald-300 p-1" data-testid="btn-wizard-collapse">
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-3 space-y-3">
            {step === 1 && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  <Button size="sm" onClick={onDrawStart} className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] gap-1 flex-col" data-testid="wiz-btn-draw">
                    <Pencil className="w-3.5 h-3.5" /> Disegna
                  </Button>
                  <Button size="sm" variant="outline" onClick={onUndo} className="h-11 bg-stone-900/60 border-stone-700 text-stone-100 text-[10px] gap-1 flex-col" data-testid="wiz-btn-undo">
                    <Undo2 className="w-3.5 h-3.5" /> Annulla
                  </Button>
                  <Button size="sm" onClick={onCloseField} disabled={!field.vertices || field.vertices.length < 3} className="h-11 bg-emerald-700 hover:bg-emerald-600 text-white text-[10px] gap-1 flex-col disabled:opacity-40" data-testid="wiz-btn-close">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Chiudi
                  </Button>
                  <Button size="sm" variant="outline" onClick={onMeasure} className="h-11 bg-stone-900/60 border-amber-700/50 text-amber-300 text-[10px] gap-1 flex-col" data-testid="wiz-btn-measure">
                    <Ruler className="w-3.5 h-3.5" /> Misura
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KV label="Superficie" value={isClosed ? areaHa.toFixed(3) : "—"} unit="ha" />
                  <KV label="Perimetro" value={isClosed ? perimeter.toFixed(0) : "—"} unit="m" />
                </div>
                {!isClosed && <div className="text-[11px] text-stone-400 text-center">Tocca "Disegna" e poi la mappa per posizionare i vertici. Almeno 3 punti richiesti.</div>}
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Interfilare</div>
                  <QuickBig value={field.config.interRow} onChange={(v) => onUpdateConfig({ interRow: v })} min={2.5} max={7.0} step={0.5} unit="m" testId="wiz-inter-row" />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Distanza tra piante</div>
                  <QuickBig value={field.config.interPlant} onChange={(v) => onUpdateConfig({ interPlant: v })} min={0.8} max={3.0} step={0.1} unit="m" testId="wiz-inter-plant" />
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Varietà</div>
                  <Select value={field.config.variety} onValueChange={(v) => onUpdateConfig({ variety: v })}>
                    <SelectTrigger className="bg-stone-900/70 border-stone-700 h-10 text-sm" data-testid="wiz-variety"><SelectValue /></SelectTrigger>
                    <SelectContent className="glass-panel border-stone-700 text-stone-100">
                      {VARIETIES.map((v) => <SelectItem key={v} value={v} className="focus:bg-emerald-900/40">{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <KV label="Piante teoriche" value={teoPiante.toLocaleString("it-IT")} unit="approx" />
                  <KV label="Densità teorica" value={`${(10000 / (field.config.interRow * field.config.interPlant)).toFixed(0)}`} unit="p/ha" />
                  <KV label="Sesto" value={`${field.config.interRow.toFixed(1)}×${field.config.interPlant.toFixed(1)}`} unit="m" />
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Capezzagna di testata</div>
                  <QuickBig value={field.config.headland} onChange={(v) => onUpdateConfig({ headland: v })} min={4} max={25} step={1} unit="m" testId="wiz-headland" />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Margine laterale</div>
                  <QuickBig value={field.config.sideMargin} onChange={(v) => onUpdateConfig({ sideMargin: v })} min={1} max={10} step={0.5} unit="m" testId="wiz-side-margin" />
                </div>
                <Button onClick={onAddObstacle} variant="outline" className="w-full h-11 bg-red-950/40 border-red-700/60 text-red-300 hover:bg-red-900/50 gap-2" data-testid="wiz-btn-obstacle">
                  <AlertTriangle className="w-4 h-4" /> Inserisci Ostacolo (Pozzo / Fabbricato / Palo)
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <KV label="Filari" value={plan?.rows?.length || 0} />
                  <KV label="Corti" value={plan?.shortRowCount || 0} accent={(plan?.shortRowCount || 0) > 0 ? "text-amber-400" : "text-emerald-300"} />
                  <KV label="Piante" value={(plan?.totalPlants || 0).toLocaleString("it-IT")} />
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Azimut File</div>
                  <QuickBig value={field.azimuth} onChange={(v) => onUpdateAzimuth(v)} min={0} max={359} step={1} unit="°" testId="wiz-azimuth" />
                  <Slider value={[field.azimuth]} min={0} max={359} step={1} onValueChange={(v) => onUpdateAzimuth(v[0])} data-testid="wiz-azimuth-slider" />
                </div>
                <Button onClick={runOptimize} className="w-full h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2 shadow-lg shadow-amber-500/20" data-testid="wiz-btn-optimize">
                  <Sparkles className="w-4 h-4" /> Ottimizza Orientamento Automatico
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <KV label="Piante" value={(plan?.totalPlants || 0).toLocaleString("it-IT")} />
                  <KV label="Media filare" value={(plan?.avgRowLength || 0).toFixed(0)} unit="m" />
                  <KV label="Corti" value={plan?.shortRowCount || 0} accent={(plan?.shortRowCount || 0) > 0 ? "text-amber-400" : "text-emerald-300"} />
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Portata gocciolatore</div>
                  <QuickBig value={field.irrigation.emitterFlow} onChange={(v) => onUpdateIrrigation({ emitterFlow: v })} min={0.6} max={4.0} step={0.1} unit="L/h" testId="wiz-emitter-flow" />
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Passo gocciolatori</div>
                  <QuickBig value={field.irrigation.emitterSpacing} onChange={(v) => onUpdateIrrigation({ emitterSpacing: v })} min={0.2} max={2.0} step={0.05} unit="m" testId="wiz-emitter-spacing" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <KV label="Piante totali" value={(plan?.totalPlants || 0).toLocaleString("it-IT")} />
                  <KV label="Densità" value={`${(plan?.density || 0).toFixed(0)}`} unit="p/ha" />
                  <KV label="Metri ala" value={(irrigationResult?.totalMeters || 0).toFixed(0)} unit="m" />
                  <KV label="Portata tot" value={(irrigationResult?.totalFlowM3h || 0).toFixed(2)} unit="m³/h" />
                </div>
                <div className="space-y-2 pt-1">
                  <Button onClick={onExportPDF} className="w-full h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2" data-testid="wiz-btn-export-pdf">
                    <FileText className="w-4 h-4" /> Scarica Scheda Tecnica PDF
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={onFlushSave} variant="outline" className="h-10 bg-stone-900/60 border-emerald-700/50 text-emerald-300 gap-1 text-xs" data-testid="wiz-btn-save">
                      <Save className="w-3.5 h-3.5" /> Salva
                    </Button>
                    <Button onClick={onExportGeoJSON} variant="outline" className="h-10 bg-stone-900/60 border-stone-700 text-stone-100 gap-1 text-xs" data-testid="wiz-btn-share">
                      <Share2 className="w-3.5 h-3.5" /> GeoJSON
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 border-t border-stone-800/70 bg-stone-950/60">
          <Button
            size="sm" variant="outline"
            disabled={step === 1}
            onClick={() => onStepChange(step - 1)}
            className="h-10 gap-1 bg-stone-900/70 border-stone-700 text-stone-100 hover:bg-stone-800 disabled:opacity-30"
            data-testid="wiz-btn-back"
          >
            <ArrowLeft className="w-4 h-4" /> Indietro
          </Button>
          <div className="flex-1"></div>
          {canNext && (
            <Button
              size="sm"
              onClick={() => onStepChange(step + 1)}
              className="h-10 gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/30"
              data-testid="wiz-btn-next"
            >
              {nextLabel} <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
