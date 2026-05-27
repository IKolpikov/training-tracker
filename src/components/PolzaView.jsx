import { useDay } from "../DayContext.jsx";
import { polza, isPolzaLog, polzaIdFromLog } from "../data/polza.js";
import { dateStr as toDateStr, logicalNow } from "../utils/date.js";

// Польза per viewed day:
//  - Today or future view: show active backlog items + items done on this day (with ✓)
//  - Past day view:        show ONLY items done on that exact day (history mode, no actives)
//  Items done on OTHER days don't show on today's view (they're archived).
export default function PolzaView() {
  const { dateStr, dayLogs, polzaDoneIds, logPolza } = useDay();

  // ids done on the viewed day (via Log entries)
  const doneViewedIds = new Set(
    dayLogs
      .filter(r => isPolzaLog(r.exercise_id))
      .map(r => polzaIdFromLog(r.exercise_id))
  );

  const todayStr = toDateStr(logicalNow());
  const isPast   = dateStr < todayStr;

  // Build visible item set per rules above
  const items = polza.filter(p => {
    if (doneViewedIds.has(p.id)) return true;     // done on this day → always show with ✓
    if (isPast) return false;                      // past day, not done that day → hide
    if (polzaDoneIds.has(p.id)) return false;     // already archived (done some other day)
    return true;                                   // active backlog item, viewing today/future
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-slate-500 px-1 mb-1">
        Польза
      </div>

      {items.length === 0 && (
        <p className="text-slate-500 text-sm pt-2">
          {isPast ? "Ничего не сделано в этот день." : "Бэклог пуст. 🎉"}
        </p>
      )}

      {items.map(p => {
        const done = doneViewedIds.has(p.id);
        return (
          <button
            key={p.id}
            onClick={() => { if (!done) logPolza(p.id); }}
            disabled={done}
            className={`flex items-center gap-3 rounded-xl border bg-slate-900 px-3 py-3 text-left transition-opacity ${
              done
                ? "border-emerald-600/40 opacity-50 cursor-default"
                : "border-slate-800 active:bg-slate-800"
            }`}
            aria-pressed={done}
          >
            <div
              className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center ${
                done ? "bg-emerald-500 border-emerald-500" : "border-slate-600"
              }`}
            >
              {done && <span className="text-slate-950 text-sm leading-none font-bold">✓</span>}
            </div>
            <div className="flex-1 text-base font-medium">{p.name}</div>
          </button>
        );
      })}
    </div>
  );
}
