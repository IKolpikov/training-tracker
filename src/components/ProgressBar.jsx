import { useMemo, useState } from "react";
import { useDay } from "../DayContext.jsx";
import { useConfig } from "../useConfig.js";
import { dayProgress } from "../utils/progress.js";
import { WEEK } from "../data/schedule.js";
import { isHabitLog } from "../data/habits.js";
import { isPolzaLog } from "../data/polza.js";
import WeekStatsModal from "./WeekStatsModal.jsx";

// Sport-only filter: weekly counter must not include habit_* / polza_* rows.
const isSportLog = (r) => !isHabitLog(r.exercise_id) && !isPolzaLog(r.exercise_id);

function barColor(pct) {
  if (pct < 33) return "bg-rose-500";
  if (pct < 67) return "bg-amber-400";
  return "bg-emerald-500";
}

// Total scheduled sets for the whole week (base setsPerSession, no catch-up).
// Recomputed whenever config changes (sheet refresh swaps schedule + setsPerSession).
function computeWeekTarget(schedule, exerciseById) {
  let t = 0;
  for (const d of WEEK) {
    for (const id of schedule[d].strength) t += (exerciseById[id]?.setsPerSession || 0);
    for (const id of schedule[d].cardio)   t += (exerciseById[id]?.setsPerSession || 0);
  }
  return t;
}

export default function ProgressBar() {
  const { day, dateStr, weekIso, weekLogs, dayLogs } = useDay();
  const { schedule, exerciseById } = useConfig();
  const [showWeekStats, setShowWeekStats] = useState(false);

  const WEEK_TARGET = useMemo(
    () => computeWeekTarget(schedule, exerciseById),
    [schedule, exerciseById]
  );

  // Day progress
  const { completed, totalTarget, pct: dayPct } = dayProgress(day, dateStr, weekLogs, dayLogs);

  // Week progress (sport only — exclude habit_* / polza_* rows)
  const { weekDone, weekPct, sportLogs } = useMemo(() => {
    const sportLogs = weekLogs.filter(isSportLog);
    const weekDone  = sportLogs.length;
    const weekPct   = WEEK_TARGET > 0
      ? Math.round((Math.min(weekDone, WEEK_TARGET) / WEEK_TARGET) * 100)
      : 0;
    return { weekDone, weekPct, sportLogs };
  }, [weekLogs]);

  return (
    <>
      <div className="fixed bottom-14 inset-x-0 z-20 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <div className="mx-auto max-w-[420px] px-4 pt-3 pb-2 flex flex-col gap-2.5">

          {/* ── Day bar ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span>День</span>
              <span className="tabular-nums">{completed}/{totalTarget} · {dayPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${barColor(dayPct)} transition-all duration-300`}
                style={{ width: `${dayPct}%` }}
              />
            </div>
          </div>

          {/* ── Week bar (clickable) ─────────────────────────────────── */}
          <button
            className="w-full text-left active:opacity-60 pb-0.5"
            onClick={() => setShowWeekStats(true)}
            aria-label="Статистика недели"
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="flex items-center gap-1">
                Неделя {weekIso}
                <span className="text-slate-600 text-[10px]">↗</span>
              </span>
              <span className="tabular-nums">{weekDone}/{WEEK_TARGET} · {weekPct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${barColor(weekPct)} transition-all duration-300`}
                style={{ width: `${weekPct}%` }}
              />
            </div>
          </button>

        </div>
      </div>

      {showWeekStats && (
        <WeekStatsModal
          weekIso={weekIso}
          weekLogs={sportLogs}
          onClose={() => setShowWeekStats(false)}
        />
      )}
    </>
  );
}
