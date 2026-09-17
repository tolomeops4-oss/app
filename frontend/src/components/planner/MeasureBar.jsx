import { Button } from "@/components/ui/button";
import { Ruler, Undo2, Trash2, X, ArrowRightLeft } from "lucide-react";

export default function MeasureBar({ points, metrics, onUndo, onClear, onExit, onUseAzimuth }) {
  const totalM = metrics?.totalM || 0;
  const az = metrics?.lastAzimuth;
  const areaM2 = metrics?.areaM2;
  return (
    <div className="fixed left-2 right-2 md:left-1/2 md:-translate-x-1/2 md:right-auto top-16 md:top-20 z-30" data-testid="measure-bar">
      <div className="glass-panel rounded-2xl px-3 md:px-4 py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2 text-amber-300 flex-shrink-0">
          <Ruler className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">Modalità Misura</span>
        </div>
        <div className="text-xs font-mono flex flex-wrap items-center gap-x-4 gap-y-1 flex-1 min-w-0">
          <span className="text-stone-300">Punti: <span className="text-amber-300 font-bold">{points?.length || 0}</span></span>
          <span className="text-stone-300">Totale: <span className="text-amber-300 font-bold">{totalM.toFixed(2)} m</span></span>
          {az !== null && az !== undefined && (
            <span className="text-stone-300">Azimut: <span className="text-amber-300 font-bold">{az.toFixed(1)}°</span></span>
          )}
          {areaM2 !== null && areaM2 !== undefined && (
            <span className="text-stone-300">Area: <span className="text-amber-300 font-bold">{areaM2.toFixed(0)} m² / {(areaM2 / 10000).toFixed(3)} ha</span></span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {az !== null && az !== undefined && (
            <Button size="sm" variant="outline" className="h-8 gap-1 bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50 text-[10px] font-semibold" onClick={() => onUseAzimuth(az)} data-testid="btn-use-azimuth" title="Applica come orientamento filari">
              <ArrowRightLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Usa Azimut</span>
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-300 hover:bg-stone-800" onClick={onUndo} data-testid="btn-measure-undo" title="Annulla ultimo punto">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-300 hover:bg-red-950/40 hover:text-red-400" onClick={onClear} data-testid="btn-measure-clear" title="Azzera misura">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-950/40" onClick={onExit} data-testid="btn-measure-exit" title="Esci dalla misura">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
