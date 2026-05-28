import { useDay } from "../DayContext.jsx";
import { useConfig } from "../useConfig.js";
import {
  cardState,
  cardioTargetToday,
  doneToday,
  strengthTargetToday
} from "../utils/progress.js";

const STATE_STYLES = {
  not_started: "border-slate-800",
  in_progress:  "border-amber-500/60",
  complete:     "border-emerald-600/40 opacity-50",
  overlogged:   "border-emerald-600/40 opacity-50"
};

export default function ExerciseCard({ exId, kind }) {
  const { day, dateStr, weekLogs, dayLogs, openMultiSet, quickLog, removeLastSet } = useDay();
  const { exerciseById } = useConfig();
  const ex = exerciseById[exId];
  if (!ex) return null;

  const target  = kind === "strength"
    ? strengthTargetToday(exId, day, weekLogs)
    : cardioTargetToday(exId, day);
  const done    = doneToday(exId, dateStr, dayLogs);
  const state   = cardState(done, target);
  const isDone  = done >= target;

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border bg-slate-900 px-3 py-3 cursor-pointer active:bg-slate-800 transition-opacity ${STATE_STYLES[state]}`}
      onClick={() => openMultiSet(exId)}
    >
      {/* Invisible [-] button: left edge, same footprint as [+]. Tap to undo last set. */}
      <button
        onClick={e => { e.stopPropagation(); removeLastSet(exId); }}
        className="absolute left-0 top-0 h-full w-12 opacity-0 rounded-l-xl"
        aria-label={`Удалить последний сет: ${ex.name}`}
      />
      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="text-base font-medium truncate">{ex.name}</div>
        {ex.description && (
          <div className="text-xs text-slate-500 truncate">{ex.description}</div>
        )}
      </div>

      {/* Counter */}
      <div className={`tabular-nums text-sm font-mono shrink-0 ${isDone ? "text-emerald-400" : "text-slate-300"}`}>
        [{done}/{target}]
      </div>

      {/* [+] quick-log: adds 1 set with defaults immediately, no modal */}
      <button
        onClick={e => { e.stopPropagation(); quickLog(exId); }}
        className="w-12 h-12 shrink-0 rounded-full bg-slate-800 text-2xl leading-none flex items-center justify-center active:bg-slate-700"
        aria-label={`Быстро залогать: ${ex.name}`}
      >+</button>
    </div>
  );
}
