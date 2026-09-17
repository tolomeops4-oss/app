import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Copy, Trash2, Edit2, Check, X, Trees, Pencil } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function FieldsDrawer({
  open,
  onOpenChange,
  fields,
  activeFieldId,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onEditPerimeter,
}) {
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const submitNew = (e) => {
    e.preventDefault();
    const n = newName.trim();
    if (!n) return;
    onCreate(n);
    setNewName("");
  };

  const submitRename = (id) => {
    const n = editName.trim();
    if (n) onRename(id, n);
    setEditId(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="glass-panel border-r border-stone-800 text-stone-100 w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-stone-800/70">
          <SheetTitle className="text-emerald-300 font-bold text-lg tracking-tight flex items-center gap-2">
            <Trees className="w-5 h-5" />
            Gestione Campi
          </SheetTitle>
          <p className="text-xs text-stone-400">Appezzamenti salvati sul server</p>
        </SheetHeader>

        <form onSubmit={submitNew} className="px-5 py-4 border-b border-stone-800/70 flex gap-2" data-testid="form-new-field">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome nuovo campo..."
            className="bg-stone-900/60 border-stone-700 text-sm text-stone-100 placeholder:text-stone-500"
            data-testid="input-new-field-name"
          />
          <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1" data-testid="btn-create-field">
            <Plus className="w-4 h-4" /> Crea
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto thin-scrollbar px-3 py-2 space-y-1" data-testid="fields-list">
          {fields.length === 0 && (
            <div className="text-center text-stone-500 text-sm py-12">
              Nessun campo ancora.<br />Crea il primo appezzamento.
            </div>
          )}
          {fields.map((f) => {
            const isActive = f.id === activeFieldId;
            const areaHa = f._areaHa;
            return (
              <div
                key={f.id}
                className={`rounded-xl border p-3 transition-colors ${isActive ? "border-emerald-500/70 bg-emerald-950/40" : "border-stone-800 bg-stone-950/40 hover:border-stone-700"}`}
                data-testid={`field-item-${f.id}`}
              >
                {editId === f.id ? (
                  <div className="flex gap-1">
                    <Input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitRename(f.id)}
                      className="bg-stone-900 border-stone-700 h-8 text-sm"
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-400" onClick={() => submitRename(f.id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-stone-400" onClick={() => setEditId(null)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => { onSelect(f.id); onOpenChange(false); }}
                    className="w-full text-left flex items-start justify-between gap-2"
                    data-testid={`btn-select-field-${f.id}`}
                  >
                    <div className="min-w-0">
                      <div className={`font-semibold text-sm truncate ${isActive ? "text-emerald-300" : "text-stone-100"}`}>{f.name}</div>
                      <div className="text-[11px] text-stone-500 font-mono mt-0.5">
                        {areaHa !== undefined ? `${areaHa.toFixed(3)} ha` : "—"} · {f.vertices?.length || 0} vertici {f.closed ? "· chiuso" : "· aperto"}
                      </div>
                    </div>
                    {isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold uppercase tracking-wider flex-shrink-0">Attivo</span>}
                  </button>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {f.closed && (
                    <Button
                      size="sm"
                      className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                      onClick={() => onEditPerimeter(f.id)}
                      data-testid={`btn-edit-perimeter-${f.id}`}
                    >
                      <Pencil className="w-3 h-3" /> Modifica Perimetro
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-stone-300 hover:bg-stone-800" onClick={() => { setEditId(f.id); setEditName(f.name); }} data-testid={`btn-rename-${f.id}`}>
                    <Edit2 className="w-3 h-3 mr-1" /> Rinomina
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-stone-300 hover:bg-stone-800" onClick={() => onDuplicate(f.id)} data-testid={`btn-duplicate-${f.id}`}>
                    <Copy className="w-3 h-3 mr-1" /> Duplica
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-red-400 hover:bg-red-950/40 ml-auto" data-testid={`btn-delete-${f.id}`}>
                        <Trash2 className="w-3 h-3 mr-1" /> Elimina
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="glass-panel border-stone-700 text-stone-100">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-400">Eliminare "{f.name}"?</AlertDialogTitle>
                        <AlertDialogDescription className="text-stone-400">
                          L'azione è definitiva. Verranno cancellati perimetro, ostacoli, filari e configurazioni.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-stone-800 border-stone-700 hover:bg-stone-700">Annulla</AlertDialogCancel>
                        <AlertDialogAction className="bg-red-600 hover:bg-red-500" onClick={() => onDelete(f.id)} data-testid={`btn-confirm-delete-${f.id}`}>
                          Elimina
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
