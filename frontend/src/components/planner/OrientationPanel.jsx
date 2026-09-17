import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Hand, Sparkles, GitCompareArrows, Radar, Minus, Plus } from "lucide-react";
import AzimuthCompass from "./AzimuthCompass";
import { polygonEdgeAzimuths, optimizeAzimuth } from "@/lib/geometry";

export default function OrientationPanel({ field, plan, onUpdateAzimuth }) {
  const [tab, setTab] = useState("manual");
  const [autoResults, setAutoResults] = useState(null);
  const [computing, setComputing] = useState(false);

  const edges = useMemo(() => {
    if (!field?.closed || !field.vertices) return [];
    const arr = polygonEdgeAzimuths(field.vertices);
    // Sort by length desc so main sides come first
    return arr.sort((a, b) => b.length - a.length);
  }, [field?.vertices, field?.closed]);

  const runOptimize = (step) => {
    if (!field?.closed) return;
    setComputing(true);
    setTimeout(() => {
      try {
        const res = optimizeAzimuth(field, step);
        setAutoResults(res);
      } finally { setComputing(false); }
    }, 30);
  };

  const nudge = (delta) => onUpdateAzimuth(((field.azimuth + delta) % 360 + 360) % 360);
  const setAzimuthDirect = (v) => onUpdateAzimuth(((v % 360) + 360) % 360);

  return (
    <div className="space-y-3" data-testid="orientation-panel">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 bg-stone-900/60 border border-stone-800 rounded-xl h-10 p-0.5 w-full">
          <TabsTrigger value="manual" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="orient-tab-manual">
            <Hand className="w-3.5 h-3.5" /><span>Manuale</span>
          </TabsTrigger>
          <TabsTrigger value="auto" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="orient-tab-auto">
            <Sparkles className="w-3.5 h-3.5" /><span>Auto</span>
          </TabsTrigger>
          <TabsTrigger value="parallel" className="text-[11px] gap-1 data-[state=active]:bg-emerald-600/90 data-[state=active]:text-white rounded-lg" data-testid="orient-tab-parallel">
            <GitCompareArrows className="w-3.5 h-3.5" /><span>Bordo</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-3 space-y-3">
          <AzimuthCompass
            azimuth={field.azimuth}
            onChange={onUpdateAzimuth}
            plantsCount={plan?.totalPlants}
            avgLen={plan?.avgRowLength}
          />
          <div className="grid grid-cols-4 gap-1.5">
            <Button size="sm" variant="outline" className="h-9 text-xs bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40" onClick={() => nudge(-1)} data-testid="btn-az-minus1">
              <Minus className="w-3 h-3 mr-0.5" />1°
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40" onClick={() => nudge(1)} data-testid="btn-az-plus1">
              <Plus className="w-3 h-3 mr-0.5" />1°
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40" onClick={() => setAzimuthDirect(0)} data-testid="btn-az-0">
              N 0°
            </Button>
            <Button size="sm" variant="outline" className="h-9 text-xs bg-stone-900/60 border-stone-700 hover:bg-emerald-950/40" onClick={() => setAzimuthDirect(90)} data-testid="btn-az-90">
              E 90°
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="auto" className="mt-3 space-y-3">
          <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-3 text-xs text-emerald-200/80">
            L'algoritmo analizza le orientazioni e sceglie quella che massimizza le piante utili minimizzando gli spezzoni corti.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => runOptimize(5)} disabled={computing || !field?.closed} className="bg-amber-950/40 border-amber-700/60 text-amber-300 hover:bg-amber-900/50 h-10 gap-1" data-testid="btn-opt-fast">
              <Radar className="w-4 h-4" /> Scan Veloce (5°)
            </Button>
            <Button variant="outline" size="sm" onClick={() => runOptimize(1)} disabled={computing || !field?.closed} className="bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50 h-10 gap-1" data-testid="btn-opt-fine">
              <Radar className="w-4 h-4" /> Scan Fine (1°)
            </Button>
          </div>
          {computing && <div className="text-xs text-stone-400 text-center animate-pulse">Calcolo in corso...</div>}
          {autoResults?.top3 && (
            <div className="space-y-1.5" data-testid="auto-results-list">
              <div className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold">Top 3 orientamenti</div>
              {autoResults.top3.map((r, i) => (
                <button
                  key={r.azimuth}
                  onClick={() => onUpdateAzimuth(r.azimuth)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors ${field.azimuth === r.azimuth ? "border-emerald-500/70 bg-emerald-950/40" : "border-stone-800 bg-stone-950/40 hover:border-emerald-700/60"}`}
                  data-testid={`auto-result-${i}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-emerald-300 font-mono font-bold text-base">{r.azimuth}°</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold uppercase tracking-wider">#{i + 1}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                    <div>
                      <div className="text-stone-500 uppercase tracking-wider">Piante</div>
                      <div className="text-stone-100 font-bold">{r.plan.totalPlants}</div>
                    </div>
                    <div>
                      <div className="text-stone-500 uppercase tracking-wider">Media m</div>
                      <div className="text-stone-100 font-bold">{r.plan.avgRowLength.toFixed(0)}</div>
                    </div>
                    <div>
                      <div className="text-stone-500 uppercase tracking-wider">Corti</div>
                      <div className={r.plan.shortRowCount > 0 ? "text-amber-400 font-bold" : "text-stone-100 font-bold"}>{r.plan.shortRowCount}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="parallel" className="mt-3 space-y-2">
          <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 p-3 text-xs text-emerald-200/80">
            Allinea i filari paralleli a un bordo del campo. Ordinati per lunghezza.
          </div>
          {edges.length === 0 && <div className="text-stone-500 text-sm text-center py-6">Chiudi il campo per elencare i bordi.</div>}
          <div className="space-y-1.5" data-testid="edges-list">
            {edges.map((e) => (
              <button
                key={`edge-${e.index}`}
                onClick={() => onUpdateAzimuth(e.azimuth)}
                className={`w-full text-left rounded-xl border p-3 transition-colors ${Math.abs(field.azimuth - e.azimuth) < 0.5 ? "border-emerald-500/70 bg-emerald-950/40" : "border-stone-800 bg-stone-950/40 hover:border-emerald-700/60"}`}
                data-testid={`edge-item-${e.index}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-stone-100 font-mono text-sm">Bordo #{e.index + 1}</span>
                  <span className="text-emerald-300 font-mono font-bold">{e.azimuth.toFixed(1)}°</span>
                </div>
                <div className="text-[10px] text-stone-500 font-mono mt-0.5">Lunghezza {e.length.toFixed(1)} m</div>
              </button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
