import { useDay } from "../DayContext.jsx";
import { polza } from "../data/polza.js";

// Польза — backlog. Items not in polzaDoneIds are shown as active.
// Tap → mark done (logs entry, hides item, triggers undo snackbar).
export default function PolzaView() {
  const { polzaDoneIds, logPolza } = useDay();
  const active = polza.filter(p => !polzaDoneIds.has(p.id));

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-slate-500 px-1 mb-1">
        Польза
      </div>

      {active.length === 0 && (
        <p className="text-slate-500 text-sm pt-2">Бэклог пуст. 🎉</p>
      )}

      {active.map(p => (
        <button
          key={p.id}
          onClick={() => logPolza(p.id)}
          className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-left active:bg-slate-800"
        >
          <div className="w-6 h-6 shrink-0 rounded-md border-2 border-slate-600" />
          <div className="flex-1 text-base font-medium">{p.name}</div>
        </button>
      ))}
    </div>
  );
}
