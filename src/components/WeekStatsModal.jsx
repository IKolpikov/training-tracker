import { useMemo } from "react";
import { WEEK, schedule } from "../data/schedule.js";
import { exerciseById } from "../data/plan.js";

// Build ordered unique breakdown of exercises for the full week.
// Strength first (in first-appearance order), then cardio.
function buildBreakdown(weekLogs) {
  const strengthMap = new Map(); // exId → { target }
  const cardioMap   = new Map();

  for (const day of WEEK) {
    for (const exId of schedule[day].strength) {
      if (!strengthMap.has(exId)) strengthMap.set(exId, { target: 0 });
      strengthMap.get(exId).target += exerciseById[exId].setsPerSession;
    }
    for (const exId of schedule[day].cardio) {
      if (!cardioMap.has(exId)) cardioMap.set(exId, { target: 0 });
      cardioMap.get(exId).target += exerciseById[exId].setsPerSession;
    }
  }

  // Count logged sets per exercise this week
  const done = {};
  for (const r of weekLogs) {
    done[r.exercise_id] = (done[r.exercise_id] || 0) + 1;
  }

  const toRow = ([exId, info]) => ({
    ex:     exerciseById[exId],
    target: info.target,
    done:   done[exId] || 0,
  });

  return {
    strength: [...strengthMap.entries()].map(toRow),
    cardio:   [...cardioMap.entries()].map(toRow),
  };
}

function ExRow({ row }) {
  const complete = row.done >= row.target;
  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-slate-800/50 last:border-0 ${complete ? "opacity-45" : ""}`}>
      <div className="flex-1 min-w-0">
        <span className="text-sm">{row.ex.name}</span>
      </div>
      <div className={`tabular-nums text-sm font-mono shrink-0 ${complete ? "text-emerald-400" : "text-slate-400"}`}>
        [{row.done}/{row.target}]
      </div>
      {/* mini inline bar */}
      <div className="w-14 h-1.5 rounded-full bg-slate-800 overflow-hidden shrink-0">
        <div
          className={`h-full rounded-full ${complete ? "bg-emerald-500" : "bg-amber-400"}`}
          style={{ width: `${Math.min(100, row.target > 0 ? Math.round((row.done / row.target) * 100) : 0)}%` }}
        />
      </div>
    </div>
  );
}

export default function WeekStatsModal({ weekIso, weekLogs, onClose }) {
  const { strength, cardio } = useMemo(() => buildBreakdown(weekLogs), [weekLogs]);

  const totalTarget = useMemo(
    () => strength.reduce((s, r) => s + r.target, 0) + cardio.reduce((s, r) => s + r.target, 0),
    [strength, cardio]
  );
  const totalDone = weekLogs.length;
  const pct = totalTarget > 0 ? Math.round((Math.min(totalDone, totalTarget) / totalTarget) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-slate-900 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 pb-6 max-h-[85vh] overflow-y-auto flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-semibold">Неделя {weekIso}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {totalDone} из {totalTarget} базовых сетов · {pct}%
            </div>
            <div className="text-xs text-slate-600 mt-1 leading-snug max-w-[260px]">
              Таргеты дней могут быть выше из-за catch-up переноса пропущенных сетов
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-800 text-lg"
            aria-label="Закрыть"
          >✕</button>
        </div>

        {/* Strength */}
        {strength.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-0.5">Силовые</div>
            {strength.map(r => <ExRow key={r.ex.id} row={r} />)}
          </div>
        )}

        {/* Cardio */}
        {cardio.length > 0 && (
          <div>
            <div className="flex items-center gap-3 text-slate-500 text-xs uppercase tracking-wider mb-0.5">
              <div className="flex-1 border-t border-slate-800" />
              <span>Cardio</span>
              <div className="flex-1 border-t border-slate-800" />
            </div>
            {cardio.map(r => <ExRow key={r.ex.id} row={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}
