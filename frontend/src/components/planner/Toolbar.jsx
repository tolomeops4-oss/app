import { PlusCircle, Undo2, CheckCircle2, AlertTriangle, Trash2, Hand, Crosshair, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const btnBase = "flex flex-col items-center gap-0.5 min-w-[62px] md:min-w-[76px] h-14 md:h-16 rounded-xl transition-all touch-manipulation";

export default function Toolbar({
  toolMode,
  onToolChange,
  onUndoPoint,
  onCloseField,
  onDeleteField,
  onGPS,
  onOptimizeAzimuth,
  canUndo,
  canClose,
  canDelete,
}) {
  const btn = (id, label, Icon, active, onClick, testId, extra = "") => (
    <Button
      variant="ghost"
      size="sm"
      className={`${btnBase} ${active ? "bg-emerald-600/90 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/30" : "text-stone-200 hover:bg-emerald-900/40 hover:text-emerald-300"} ${extra}`}
      onClick={onClick}
      data-testid={testId}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide leading-none">{label}</span>
    </Button>
  );

  return (
    <div
      className="fixed bottom-2 left-2 right-2 md:bottom-5 md:left-1/2 md:right-auto md:-translate-x-1/2 z-30"
      data-testid="bottom-toolbar"
    >
      <div className="glass-panel rounded-2xl p-1.5 md:p-2 flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar">
        {btn("draw-field", "Nuovo Campo", PlusCircle, toolMode === "draw-field", () => onToolChange("draw-field"), "btn-new-field")}
        {btn("undo", "Annulla", Undo2, false, onUndoPoint, "btn-undo-point", canUndo ? "" : "opacity-40 pointer-events-none")}
        {btn("close", "Chiudi/Salva", CheckCircle2, false, onCloseField, "btn-close-field", canClose ? "text-emerald-300" : "opacity-40 pointer-events-none")}
        {btn("add-obstacle-point", "Ostacolo", AlertTriangle, toolMode?.startsWith("add-obstacle"), () => onToolChange("add-obstacle-point"), "btn-add-obstacle")}
        {btn("delete-boundary", "Elimina", Trash2, false, onDeleteField, "btn-delete-boundary", canDelete ? "text-red-400 hover:text-red-300" : "opacity-40 pointer-events-none")}
        {btn("pan", "Sposta", Hand, toolMode === "pan", () => onToolChange("pan"), "btn-pan-mode")}
        {btn("gps", "GPS", Crosshair, false, onGPS, "btn-gps-position")}
        <div className="hidden md:block w-px h-10 bg-stone-700 mx-1"></div>
        {btn("optimize", "Ottimizza", Sparkles, false, onOptimizeAzimuth, "btn-optimize-azimuth", canClose ? "text-amber-300" : "opacity-40 pointer-events-none")}
      </div>
    </div>
  );
}
