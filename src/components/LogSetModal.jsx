import { useEffect, useMemo, useState } from "react";

// Build initial form values per exercise type.
function initialFields(ex) {
  if (ex.type === "STR") {
    return { reps: ex.defaultReps ?? "", load: ex.defaultLoad ?? "" };
  }
  if (ex.type === "ISO") {
    return { load: ex.defaultLoad ?? "" }; // sec lives in `load` per H/I/J mapping
  }
  // CARDIO: one field per cardioFields entry, keyed by .key
  const out = {};
  for (const f of ex.cardioFields || []) out[f.key] = f.default ?? "";
  return out;
}

// Map form values -> Log columns (writes only what's relevant; rest stays "").
function toEntryFields(ex, vals) {
  if (ex.type === "STR") {
    return {
      reps: numOrEmpty(vals.reps),
      load: numOrEmpty(vals.load),
      unit: ex.unit ?? ""
    };
  }
  if (ex.type === "ISO") {
    return {
      reps: 1,
      load: numOrEmpty(vals.load),
      unit: ex.unit ?? "sec"
    };
  }
  const out = {};
  for (const f of ex.cardioFields || []) {
    out[f.key] = numOrEmpty(vals[f.key]); // distance_km/duration_min/quality_min
  }
  return out;
}

function numOrEmpty(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

export default function LogSetModal({ exercise, onClose, onSave }) {
  const [vals, setVals] = useState(() => initialFields(exercise));

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fields = useMemo(() => {
    if (exercise.type === "STR") {
      return [
        { key: "load", label: `Вес`, unit: exercise.unit, inputMode: "decimal" },
        { key: "reps", label: "Повторы", unit: "reps", inputMode: "numeric" }
      ];
    }
    if (exercise.type === "ISO") {
      return [{ key: "load", label: "Удержание", unit: "sec", inputMode: "numeric" }];
    }
    return (exercise.cardioFields || []).map(f => ({
      key: f.key, label: f.label, unit: f.unit, inputMode: "decimal"
    }));
  }, [exercise]);

  const update = (k, v) => setVals(prev => ({ ...prev, [k]: v }));

  const submit = (e) => {
    e?.preventDefault?.();
    onSave(toEntryFields(exercise, vals));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-[420px] bg-slate-900 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 pb-6 flex flex-col gap-4"
      >
        <div>
          <div className="text-lg font-semibold">{exercise.name}</div>
          {exercise.description && (
            <div className="text-xs text-slate-500 mt-0.5">{exercise.description}</div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {fields.map(f => (
            <label key={f.key} className="flex items-center gap-3">
              <span className="w-28 text-sm text-slate-400">{f.label}</span>
              <input
                type="number"
                inputMode={f.inputMode}
                step="any"
                value={vals[f.key] ?? ""}
                onChange={(e) => update(f.key, e.target.value)}
                className="flex-1 h-12 px-3 rounded-lg bg-slate-800 border border-slate-700 text-base outline-none focus:border-amber-500"
                autoFocus={f.key === fields[0].key}
              />
              <span className="text-xs text-slate-500 w-10">{f.unit}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 rounded-lg border border-slate-700 text-slate-300 active:bg-slate-800"
          >Отмена</button>
          <button
            type="submit"
            className="flex-[2] h-12 rounded-lg bg-amber-500 text-slate-950 font-semibold active:bg-amber-400"
          >Сохранить</button>
        </div>
      </form>
    </div>
  );
}
