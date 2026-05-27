import { useRef, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────

function blockDefault(ex) {
  if (ex.type === "STR") {
    return {
      reps: ex.defaultReps !== null && ex.defaultReps !== undefined ? String(ex.defaultReps) : "",
      load: ex.defaultLoad !== null && ex.defaultLoad !== undefined ? String(ex.defaultLoad) : ""
    };
  }
  if (ex.type === "ISO") {
    return {
      load: ex.defaultLoad !== null && ex.defaultLoad !== undefined ? String(ex.defaultLoad) : ""
    };
  }
  // CARDIO
  const o = {};
  for (const f of ex.cardioFields || []) {
    o[f.key] = f.default !== null && f.default !== undefined ? String(f.default) : "";
  }
  return o;
}

function blockFields(ex) {
  if (ex.type === "STR") return [
    { key: "load",  label: "Вес",      unit: ex.unit || "kg", inputMode: "decimal" },
    { key: "reps",  label: "Повторы",  unit: "reps",          inputMode: "numeric" }
  ];
  if (ex.type === "ISO") return [
    { key: "load",  label: "Удержание", unit: "sec",           inputMode: "numeric" }
  ];
  return (ex.cardioFields || []).map(f => ({
    key: f.key, label: f.label, unit: f.unit || "", inputMode: "decimal"
  }));
}

function toEntryFields(ex, vals) {
  const n = (v) => (v !== "" && v !== null && v !== undefined && !isNaN(+v)) ? +v : "";
  if (ex.type === "STR") return { reps: n(vals.reps), load: n(vals.load), unit: ex.unit || "" };
  if (ex.type === "ISO") return { reps: 1, load: n(vals.load), unit: "sec" };
  const out = {};
  for (const f of ex.cardioFields || []) out[f.key] = n(vals[f.key]);
  return out;
}

// ─── component ──────────────────────────────────────────────────────────────

export default function MultiSetModal({ exercise, target, done, onClose, onSave }) {
  const N = Math.max(target, 1);
  const remaining = Math.max(0, target - done);

  // N blocks, all pre-filled with exercise defaults
  const [sets, setSets] = useState(() =>
    Array.from({ length: N }, () => ({ ...blockDefault(exercise) }))
  );

  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const fields = blockFields(exercise);

  const update = (i, key, val) =>
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));

  // Save only the sets that aren't logged yet (from index `done` onwards)
  const handleOK = () => {
    if (remaining <= 0) { onClose(); return; }
    const toSave = Array.from({ length: remaining }, (_, i) => {
      const setIdx = Math.min(done + i, sets.length - 1);
      return toEntryFields(exercise, sets[setIdx]);
    });
    onSave(toSave);
  };

  // Horizontal swipe (left or right) → close. Ignore vertical scrolling.
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 70 && Math.abs(dx) > dy * 1.3) onClose();
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const okLabel = remaining > 0
    ? `ОК · сохранить ${remaining} ${remaining === 1 ? "сет" : remaining < 5 ? "сета" : "сетов"}`
    : "ОК";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] bg-slate-900 border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl p-4 pb-6 flex flex-col gap-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <div className="text-lg font-semibold">{exercise.name}</div>
            {exercise.description && (
              <div className="text-xs text-slate-500 mt-0.5 leading-snug">{exercise.description}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-800 text-lg"
            aria-label="Закрыть"
          >✕</button>
        </div>

        {/* Set blocks */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: N }, (_, i) => {
            const isDone = i < done;
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  isDone
                    ? "border-emerald-700/30 bg-slate-800/30"
                    : "border-slate-700 bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-300">Rep {i + 1}</span>
                  {isDone && (
                    <span className="text-emerald-400 text-xs font-medium">✓ выполнен</span>
                  )}
                </div>

                <div className="flex gap-2">
                  {fields.map(f => (
                    <label key={f.key} className="flex-1 flex flex-col gap-1">
                      <span className="text-xs text-slate-500">
                        {f.label}{f.unit ? ` (${f.unit})` : ""}
                      </span>
                      <input
                        type="number"
                        inputMode={f.inputMode}
                        step="any"
                        value={sets[i]?.[f.key] ?? ""}
                        onChange={e => update(i, f.key, e.target.value)}
                        disabled={isDone}
                        className="h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-base outline-none focus:border-amber-500 disabled:text-slate-600 disabled:border-slate-800 w-full"
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {remaining === 0 && (
          <p className="text-center text-emerald-400 text-sm py-1">Все сеты выполнены ✓</p>
        )}

        <button
          onClick={handleOK}
          className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-semibold active:bg-amber-400 mt-1"
        >
          {okLabel}
        </button>
      </div>
    </div>
  );
}
