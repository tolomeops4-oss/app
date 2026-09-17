import { Check, MapPinned, Grid3x3, Scaling, Compass, Droplets } from "lucide-react";

const STEPS = [
  { id: 1, label: "Confine", icon: MapPinned },
  { id: 2, label: "Sesto", icon: Grid3x3 },
  { id: 3, label: "Capezzagne", icon: Scaling },
  { id: 4, label: "Orientamento", icon: Compass },
  { id: 5, label: "Irrigazione & PDF", icon: Droplets },
];

export default function WizardStepper({ current, onStep, unlockedUpTo }) {
  return (
    <div className="fixed top-16 md:top-20 left-2 right-2 md:left-4 md:right-4 z-20" data-testid="wizard-stepper">
      <div className="glass-panel rounded-2xl px-2 py-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {STEPS.map((s, i) => {
          const isActive = current === s.id;
          const isDone = current > s.id;
          const isUnlocked = s.id <= unlockedUpTo;
          const Icon = isDone ? Check : s.icon;
          return (
            <button
              key={s.id}
              onClick={() => isUnlocked && onStep(s.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-xl text-[10px] md:text-xs font-semibold transition-all ${
                isActive
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                  : isDone
                    ? "bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60"
                    : isUnlocked
                      ? "bg-stone-900/60 text-stone-300 hover:bg-stone-800"
                      : "bg-stone-950/40 text-stone-600 cursor-not-allowed"
              }`}
              disabled={!isUnlocked}
              data-testid={`wizard-step-${s.id}`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                isActive ? "bg-white/20" : isDone ? "bg-emerald-600" : "bg-stone-700"
              }`}>
                <Icon className="w-3 h-3" />
              </div>
              <span className="hidden sm:inline whitespace-nowrap">{s.label}</span>
              <span className="sm:hidden">{s.id}</span>
              {i < STEPS.length - 1 && <span className="text-stone-600 ml-0.5 hidden md:inline">›</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
