import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";

export default function EditPerimeterBar({ vertexCount, areaHa, onSave, onCancel }) {
  return (
    <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 md:gap-3" data-testid="edit-perimeter-bar">
      <div className="glass-panel rounded-2xl px-4 py-2 flex items-center gap-3">
        <div className="flex items-center gap-2 text-emerald-300">
          <Pencil className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest font-semibold hidden sm:inline">Modifica Perimetro</span>
        </div>
        <div className="hidden md:block w-px h-6 bg-stone-700"></div>
        <div className="text-xs font-mono">
          <span className="text-stone-100 font-bold">{vertexCount} vertici</span>
          {areaHa !== null && <span className="text-stone-400 ml-2">≈ {areaHa.toFixed(3)} ha</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-10 gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/30"
          onClick={onSave}
          data-testid="btn-save-perimeter"
        >
          <Check className="w-4 h-4" /> Salva
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-10 gap-1 bg-stone-950/90 border-stone-700 text-stone-100 hover:bg-red-950/40 hover:border-red-700/60"
          onClick={onCancel}
          data-testid="btn-cancel-perimeter"
        >
          <X className="w-4 h-4" /> Annulla
        </Button>
      </div>
    </div>
  );
}
