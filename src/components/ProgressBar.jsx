import { useDay } from "../DayContext.jsx";
import { dayProgress } from "../utils/progress.js";

function pctColor(pct) {
  if (pct < 33) return "bg-rose-500";
  if (pct < 67) return "bg-amber-400";
  return "bg-emerald-500";
}

export default function ProgressBar() {
  const { day, dateStr, weekLogs, dayLogs } = useDay();
  const { pct, completed, totalTarget } = dayProgress(day, dateStr, weekLogs, dayLogs);

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-slate-950/95 backdrop-blur border-t border-slate-800">
      <div className="mx-auto max-w-[420px] px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>День</span>
          <span className="tabular-nums">{completed}/{totalTarget} · {pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${pctColor(pct)} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
