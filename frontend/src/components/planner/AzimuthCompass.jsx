import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Compass } from "lucide-react";

function bearingLabel(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const i = Math.round(((deg % 360) / 45)) % 8;
  return dirs[i];
}

export default function AzimuthCompass({ azimuth, onChange, plantsCount, avgLen }) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const [inputVal, setInputVal] = useState(String(azimuth.toFixed(1)));

  const ticks = useMemo(() => {
    const arr = [];
    for (let a = 0; a < 360; a += 15) arr.push(a);
    return arr;
  }, []);

  const rotateStyle = { transform: `rotate(${azimuth}deg)` };

  const commitInput = () => {
    const v = parseFloat(inputVal);
    if (!isNaN(v)) onChange(Math.max(0, Math.min(359, v)));
    else setInputVal(String(azimuth.toFixed(1)));
  };

  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col items-center gap-3" data-testid="azimuth-compass">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 text-emerald-300">
          <Compass className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest font-semibold">Azimut File</span>
        </div>
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={commitInput}
          onKeyDown={(e) => e.key === "Enter" && commitInput()}
          className="w-16 bg-stone-900 border border-stone-700 rounded-md px-2 py-0.5 text-xs font-mono text-emerald-300 text-center focus:outline-none focus:border-emerald-500"
          data-testid="input-azimuth-value"
        />
      </div>

      <div className="relative w-40 h-40 rounded-full bg-gradient-to-br from-stone-950 to-stone-900 border border-stone-700 shadow-inner">
        {ticks.map((a) => {
          const isCardinal = a % 90 === 0;
          const isCross = a % 45 === 0;
          const len = isCardinal ? 12 : isCross ? 8 : 4;
          return (
            <div key={a} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${a}deg) translateY(-72px)` }}>
              <div className={`w-0.5 ${isCardinal ? "bg-emerald-400" : "bg-stone-500"}`} style={{ height: `${len}px` }} />
            </div>
          );
        })}
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => (
          <div key={a} className="absolute left-1/2 top-1/2 text-[10px] font-mono font-bold" style={{
            transform: `rotate(${a}deg) translateY(-56px) rotate(-${a}deg)`,
            marginLeft: -6,
            marginTop: -6,
            color: a === 0 ? "#38e07a" : "#9ca3af",
          }}>
            {dirs[i]}
          </div>
        ))}
        <div className="absolute inset-3 rounded-full border border-stone-700/40 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#38e07a]"></div>
          <div className="absolute w-1 origin-bottom transition-transform" style={{ ...rotateStyle, height: "50px", bottom: "50%" }}>
            <div className="w-1 h-full bg-gradient-to-t from-orange-500 to-orange-300 rounded-t shadow-[0_0_6px_#e76f51]"></div>
          </div>
          <div className="absolute w-1 origin-top transition-transform" style={{ ...rotateStyle, height: "50px", top: "50%" }}>
            <div className="w-1 h-full bg-gradient-to-b from-stone-600 to-stone-500 rounded-b"></div>
          </div>
        </div>
      </div>

      <div className="w-full text-center">
        <div className="font-mono text-2xl font-bold text-emerald-300">{azimuth.toFixed(0)}° {bearingLabel(azimuth)}</div>
        <div className="text-[10px] text-stone-500 uppercase tracking-widest mt-0.5">Orientamento Filari</div>
      </div>

      <Slider
        value={[azimuth]}
        min={0}
        max={359}
        step={1}
        onValueChange={(v) => { onChange(v[0]); setInputVal(String(v[0].toFixed(1))); }}
        className="w-full"
        data-testid="slider-azimuth"
      />

      {plantsCount !== undefined && (
        <div className="grid grid-cols-2 gap-2 w-full text-center pt-1">
          <div className="rounded-lg bg-stone-900/60 border border-stone-800 py-1.5">
            <div className="text-[10px] uppercase tracking-widest text-stone-500">Piante</div>
            <div className="font-mono text-sm font-bold text-emerald-300">{plantsCount}</div>
          </div>
          <div className="rounded-lg bg-stone-900/60 border border-stone-800 py-1.5">
            <div className="text-[10px] uppercase tracking-widest text-stone-500">Media Filare</div>
            <div className="font-mono text-sm font-bold text-emerald-300">{(avgLen || 0).toFixed(0)}m</div>
          </div>
        </div>
      )}
    </div>
  );
}
