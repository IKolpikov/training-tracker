import { useRef } from "react";
import { useDay } from "../DayContext.jsx";
import { useConfig } from "../useConfig.js";
import { dateStr as toDateStr, logicalNow } from "../utils/date.js";

// Long-press threshold for the invisible left-edge MINUS — guards against accidental
// taps which silently lose data on mobile.
const LONG_PRESS_MS = 400;

// Invisible left-edge target. Fires onTrigger after a sustained press; only
// distinguishes a steady hold from a scroll/swipe by a movement THRESHOLD
// (>10px from the start point cancels). Cancelling on any micro-movement
// made the long-press effectively impossible to land on mobile.
const LONG_PRESS_PX = 10;
function LongPressDelete({ onTrigger, label }) {
  const timer = useRef(null);
  const start = useRef(null);
  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    start.current = null;
  };
  const arm = (e) => {
    e.stopPropagation();
    const t = e.touches ? e.touches[0] : e;
    start.current = { x: t.clientX, y: t.clientY };
    timer.current = setTimeout(() => { timer.current = null; start.current = null; onTrigger(); }, LONG_PRESS_MS);
  };
  const move = (e) => {
    if (!start.current || !timer.current) return;
    const t = e.touches ? e.touches[0] : e;
    if (Math.hypot(t.clientX - start.current.x, t.clientY - start.current.y) > LONG_PRESS_PX) cancel();
  };
  return (
    <button
      onMouseDown={arm}     onMouseUp={cancel}    onMouseLeave={cancel}   onMouseMove={move}
      onTouchStart={arm}    onTouchEnd={cancel}   onTouchMove={move}      onTouchCancel={cancel}
      onContextMenu={e => e.preventDefault()}
      className="absolute left-0 top-0 h-full w-12 opacity-0 rounded-l-xl"
      aria-label={label}
    />
  );
}
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

  // Past-day incomplete: missed reps moved into carry to the next scheduled day.
  // Surface this in the counter color (rose) so the history is glanceable.
  // The card stays fully editable (tap to open modal, [+] to add, invisible [−] to remove).
  const todayStr = toDateStr(logicalNow());
  const isPastIncomplete = dateStr < todayStr && done < target;

  const counterClass = isPastIncomplete
    ? "text-rose-400"
    : isDone
      ? "text-emerald-400"
      : "text-slate-300";

  return (
    <div
      className={`relative flex items-center gap-3 rounded-xl border bg-slate-900 px-3 py-3 cursor-pointer active:bg-slate-800 transition-opacity ${STATE_STYLES[state]}`}
      onClick={() => openMultiSet(exId)}
    >
      <LongPressDelete onTrigger={() => removeLastSet(exId)} label={`Удалить последний сет: ${ex.name}`} />
      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="text-base font-medium truncate">{ex.name}</div>
        {ex.description && (
          <div className="text-xs text-slate-500 truncate">{ex.description}</div>
        )}
      </div>

      {/* Counter */}
      <div className={`tabular-nums text-sm font-mono shrink-0 ${counterClass}`}>
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
