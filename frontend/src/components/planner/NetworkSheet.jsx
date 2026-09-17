import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NETWORK_ELEMENT_TYPES } from "@/lib/defaults";
import { Droplet, Cog, Filter, ToggleRight, X } from "lucide-react";

const ICONS = {
  pozzo: Droplet,
  pompa: Cog,
  filtro: Filter,
  valvola: ToggleRight,
};

const HINTS = {
  pozzo: "Punto sorgente acqua — non necessita snap",
  pompa: "Cuore idraulico, tipicamente vicino al pozzo",
  filtro: "Nodo di filtrazione e fertirrigazione",
  valvola: "Snap automatico al filare più vicino (soglia 8 m). Assegna il settore.",
};

export default function NetworkSheet({ open, onOpenChange, onSelectType }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-panel border-t border-stone-800 text-stone-100 rounded-t-2xl p-0 max-h-[80vh]"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-stone-800/70 text-left">
          <SheetTitle className="text-emerald-300 font-bold text-base tracking-tight flex items-center gap-2">
            💧 Rete Irrigazione
          </SheetTitle>
          <p className="text-xs text-stone-400 mt-0.5">
            Scegli l'elemento e tocca la mappa. Le valvole si aggancino automaticamente ai filari.
          </p>
        </SheetHeader>
        <div className="px-4 py-4 grid grid-cols-2 gap-2" data-testid="network-type-grid">
          {NETWORK_ELEMENT_TYPES.map((t) => {
            const Icon = ICONS[t.id] || Droplet;
            return (
              <Button
                key={t.id}
                variant="outline"
                className="h-24 flex flex-col items-center justify-center gap-1.5 bg-stone-900/60 border-stone-700 hover:bg-sky-950/40 hover:border-sky-700/60 text-stone-100 p-2"
                onClick={() => onSelectType(t)}
                data-testid={`btn-network-type-${t.id}`}
              >
                <Icon className="w-6 h-6 text-sky-400" />
                <span className="text-xs font-semibold text-center leading-tight">{t.label}</span>
                <span className="text-[9px] text-stone-500 text-center leading-tight">{HINTS[t.id]}</span>
              </Button>
            );
          })}
        </div>
        <div className="px-4 pb-4 pt-1 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-stone-400 hover:text-stone-200 gap-1" data-testid="btn-cancel-network">
            <X className="w-4 h-4" /> Annulla
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
