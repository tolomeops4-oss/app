import { Search, Layers, Menu, ChevronDown, Compass, MapPin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TILE_LAYERS, QUICK_LOCATIONS } from "@/lib/defaults";
import UserMenu from "@/auth/UserMenu";

export default function TopBar({
  activeField,
  fieldsCount,
  tileLayerId,
  onTileLayerChange,
  onOpenFields,
  onOpenPanel,
  onSearch,
  onQuickLocation,
  onBackup,
  onRestore,
}) {
  const [q, setQ] = useState("");
  const activeLayer = TILE_LAYERS.find((t) => t.id === tileLayerId) || TILE_LAYERS[0];

  const submit = (e) => {
    e.preventDefault();
    const s = q.trim();
    if (!s) return;
    onSearch(s);
  };

  return (
    <div className="fixed top-2 left-2 right-2 md:top-3 md:left-4 md:right-4 z-30 flex items-center gap-2 md:gap-3">
      {/* Field drawer button */}
      <Button
        variant="ghost"
        size="sm"
        className="glass-panel h-11 md:h-12 rounded-xl px-3 md:px-4 gap-2 text-emerald-50 hover:bg-emerald-950/60 hover:text-emerald-300 flex-shrink-0"
        onClick={onOpenFields}
        data-testid="btn-open-fields-drawer"
      >
        <Menu className="w-4 h-4" />
        <div className="hidden md:flex flex-col items-start leading-none">
          <span className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-semibold">Campi</span>
          <span className="text-xs font-semibold truncate max-w-[160px]">{activeField?.name || "Nessun campo"}</span>
        </div>
        <div className="md:hidden text-xs font-semibold truncate max-w-[100px]">
          {activeField?.name || "Campi"}
        </div>
        <span className="ml-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">{fieldsCount}</span>
      </Button>

      {/* Search */}
      <form onSubmit={submit} className="glass-panel h-11 md:h-12 rounded-xl px-2 md:px-3 flex items-center gap-2 flex-1 min-w-0" data-testid="search-form">
        <Search className="w-4 h-4 text-emerald-400/70 flex-shrink-0" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca località o coordinate (es. 40.49,17.99)"
          className="bg-transparent border-none focus-visible:ring-0 h-8 text-sm placeholder:text-stone-500 px-0"
          data-testid="input-search-location"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-xs text-emerald-300 hover:bg-emerald-900/40 flex-shrink-0" data-testid="btn-quick-locations">
              <MapPin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Preset</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass-panel border-stone-700 text-stone-100">
            <DropdownMenuLabel className="text-emerald-400 text-[10px] uppercase tracking-widest">Località rapide</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-stone-800" />
            {QUICK_LOCATIONS.map((loc) => (
              <DropdownMenuItem
                key={loc.label}
                className="text-xs cursor-pointer focus:bg-emerald-900/40"
                onClick={() => onQuickLocation(loc)}
                data-testid={`quick-loc-${loc.label}`}
              >
                <MapPin className="w-3 h-3 mr-2 text-emerald-400" />
                {loc.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </form>

      {/* Layer selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="glass-panel h-11 md:h-12 rounded-xl px-3 gap-2 text-emerald-50 hover:bg-emerald-950/60 hover:text-emerald-300 flex-shrink-0"
            data-testid="btn-tile-layer-selector"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-semibold truncate max-w-[110px]">{activeLayer.name}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 glass-panel border-stone-700 text-stone-100">
          <DropdownMenuLabel className="text-emerald-400 text-[10px] uppercase tracking-widest">Sorgenti Satellitari</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-stone-800" />
          {TILE_LAYERS.map((l) => (
            <DropdownMenuItem
              key={l.id}
              className={`text-xs cursor-pointer focus:bg-emerald-900/40 ${l.id === tileLayerId ? "text-emerald-400 font-semibold" : ""}`}
              onClick={() => onTileLayerChange(l.id)}
              data-testid={`tile-layer-${l.id}`}
            >
              <Layers className="w-3 h-3 mr-2 text-emerald-400/70" />
              {l.name}
              {l.id === tileLayerId && <span className="ml-auto text-emerald-400">●</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Right panel button */}
      <Button
        variant="ghost"
        size="sm"
        className="glass-panel h-11 md:h-12 rounded-xl px-3 md:px-4 gap-2 text-emerald-50 hover:bg-emerald-950/60 hover:text-emerald-300 flex-shrink-0"
        onClick={onOpenPanel}
        data-testid="btn-open-side-panel"
      >
        <Compass className="w-4 h-4" />
        <span className="hidden md:inline text-xs font-semibold">Strumenti</span>
      </Button>

      <UserMenu onBackup={onBackup} onRestore={onRestore} />
    </div>
  );
}
