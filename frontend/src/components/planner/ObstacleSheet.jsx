import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { OBSTACLE_TYPES } from "@/lib/defaults";
import { Zap, Home, Droplet, Mountain, Trees, X } from "lucide-react";

const ICONS = {
  palo: Zap,
  fabbricato: Home,
  pozzo: Droplet,
  roccia: Mountain,
  albero: Trees,
};

export default function ObstacleSheet({ open, onOpenChange, onSelectType }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-panel border-t border-stone-800 text-stone-100 rounded-t-2xl p-0 max-h-[75vh]"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-stone-800/70 text-left">
          <SheetTitle className="text-emerald-300 font-bold text-base tracking-tight flex items-center gap-2">
            ⚠️ Nuovo Ostacolo
          </SheetTitle>
          <p className="text-xs text-stone-400 mt-0.5">
            Scegli il tipo. Poi tocca la mappa per posizionarlo.
          </p>
        </SheetHeader>
        <div className="px-4 py-4 grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="obstacle-type-grid">
          {OBSTACLE_TYPES.map((t) => {
            const Icon = ICONS[t.id] || Zap;
            return (
              <Button
                key={t.id}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-1 bg-stone-900/60 border-stone-700 hover:bg-red-950/40 hover:border-red-700/60 text-stone-100"
                onClick={() => onSelectType(t)}
                data-testid={`btn-obstacle-type-${t.id}`}
              >
                <Icon className="w-5 h-5 text-red-400" />
                <span className="text-xs font-semibold text-center leading-tight">{t.label}</span>
                <span className="text-[9px] font-mono text-stone-500">buffer {t.along}m × {t.side}m</span>
              </Button>
            );
          })}
        </div>
        <div className="px-4 pb-4 pt-1 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-stone-400 hover:text-stone-200 gap-1" data-testid="btn-cancel-obstacle">
            <X className="w-4 h-4" /> Annulla
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
