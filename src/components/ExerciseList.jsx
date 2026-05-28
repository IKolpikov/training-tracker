import { useDay } from "../DayContext.jsx";
import { useConfig } from "../useConfig.js";
import ExerciseCard from "./ExerciseCard.jsx";

export default function ExerciseList() {
  const { day, loading } = useDay();
  const { schedule } = useConfig();
  const plan = schedule[day];

  if (loading && (!plan || (plan.strength.length + plan.cardio.length) === 0)) {
    return <p className="text-slate-500 text-sm pt-4">Загружаю…</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs uppercase tracking-wider text-slate-500 px-1 mb-1">
        {plan.circuitLabel}
      </div>

      {plan.strength.map(exId => (
        <ExerciseCard key={exId} exId={exId} kind="strength" />
      ))}

      {plan.cardio.length > 0 && (
        <div className="flex items-center gap-3 text-slate-500 text-xs uppercase tracking-wider my-3">
          <div className="flex-1 border-t border-slate-800" />
          <span>Cardio</span>
          <div className="flex-1 border-t border-slate-800" />
        </div>
      )}

      {plan.cardio.map(exId => (
        <ExerciseCard key={exId} exId={exId} kind="cardio" />
      ))}
    </div>
  );
}
