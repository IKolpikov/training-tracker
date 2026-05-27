import { useDay } from "../DayContext.jsx";
import { habits, habitsByDay, habitLogId } from "../data/habits.js";

// Habits for the viewed day. Tap a row → log; tap again → remove last log.
// Done = at least one habit_<id> entry exists in dayLogs for today.
export default function HabitsView() {
  const { day, dayLogs, logHabit, removeHabit } = useDay();
  const ids = habitsByDay[day] || [];

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-slate-500 px-1 mb-1">
        Habits
      </div>

      {ids.length === 0 && (
        <p className="text-slate-500 text-sm pt-2">На сегодня ничего.</p>
      )}

      {ids.map(id => {
        const h     = habits[id];
        const logId = habitLogId(id);
        const done  = dayLogs.some(r => r.exercise_id === logId);
        return (
          <button
            key={id}
            onClick={() => (done ? removeHabit(id) : logHabit(id))}
            className={`flex items-center gap-3 rounded-xl border bg-slate-900 px-3 py-3 text-left transition-opacity active:bg-slate-800 ${
              done ? "border-emerald-600/40 opacity-50" : "border-slate-800"
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
            <div className="flex-1 text-base font-medium">{h.name}</div>
          </button>
        );
      })}
    </div>
  );
}
