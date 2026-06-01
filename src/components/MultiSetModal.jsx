import { useMemo, useRef, useState } from "react";

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
  const o = {};
  for (const f of ex.cardioFields || []) {
    o[f.key] = f.default !== null && f.default !== undefined ? String(f.default) : "";
  }
  return o;
}

function blockFields(ex) {
  if (ex.type === "STR") return [
    { key: "load",  label: "Вес",      unit: ex.unit || "kg", inputMode: "decimal", type: "number" },
    { key: "reps",  label: "Повторы",  unit: "reps",          inputMode: "numeric", type: "number" }
  ];
  if (ex.type === "ISO") return [
    { key: "load",  label: "Удержание", unit: "sec",          inputMode: "numeric", type: "number" }
  ];
  return (ex.cardioFields || []).map(f => ({
    key: f.key, label: f.label, unit: f.unit || "", inputMode: "decimal", type: "text"
  }));
}

// Logged-row → block values.
function blockFromEntry(ex, entry) {
  const s = (v) => (v === null || v === undefined || v === "") ? "" : String(v);
  if (ex.type === "STR") return { reps: s(entry.reps), load: s(entry.load) };
  if (ex.type === "ISO") return { load: s(entry.load) };
  const o = {};
  for (const f of ex.cardioFields || []) o[f.key] = s(entry[f.key]);
  return o;
}

// Block values → Log row fields (the bits we write to the row).
function toEntryFields(ex, vals) {
  const n = (v) => (v !== "" && v !== null && v !== undefined && !isNaN(+v)) ? +v : "";
  if (ex.type === "STR") return { reps: n(vals.reps), load: n(vals.load), unit: ex.unit || "" };
  if (ex.type === "ISO") return { reps: 1, load: n(vals.load), unit: "sec" };
  const out = {};
  for (const f of ex.cardioFields || []) {
    const v = vals[f.key];
    out[f.key] = (v === null || v === undefined) ? "" : String(v).trim();
  }
  return out;
}

// ─── component ──────────────────────────────────────────────────────────────
//
// loggedSets   — actual server rows for this exercise/day (editable).
// pendingSets  — values typed earlier for not-yet-logged sets (by setIdx).
// onSave(edits, pendings) — edits = [{timestamp,fields}] for changed logged rows;
//                            pendings = [{setIdx,fields}] for typed future-set blocks.
//                            Any close path (Done / ✕ / backdrop / swipe) calls this.

export default function MultiSetModal({
  exercise, target, done, loggedSets = [], pendingSets = [], onClose, onSave,
}) {
  const N = Math.max(target, done, 1);
  const fields = blockFields(exercise);

  // Initial block values + a pending-by-setIdx lookup (computed once on mount).
  // "touched" is derivable: a block is touched iff its current value differs
  // from this initial snapshot — so we don't track it separately.
  const initial = useMemo(() => {
    const pendingMap = new Map(pendingSets.map(p => [p.setIdx, p.fields]));
    return Array.from({ length: N }, (_, i) => {
      if (i < loggedSets.length) return blockFromEntry(exercise, loggedSets[i]);
      return pendingMap.get(i) ? { ...pendingMap.get(i) } : { ...blockDefault(exercise) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [sets, setSets] = useState(() => initial.map(b => ({ ...b })));

  const update = (i, key, val) =>
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: val } : s));

  const differsFromInitial = (i) =>
    fields.some(f => String(sets[i]?.[f.key] ?? "") !== String(initial[i]?.[f.key] ?? ""));

  // Any close path: persist edits to logged rows + pendings to future-set rows.
  // Untouched (==initial) blocks generate neither, so plan defaults never get
  // auto-logged or auto-stashed.
  const persistAndClose = () => {
    const edits = [];
    const pendings = [];
    for (let i = 0; i < sets.length; i++) {
      if (!differsFromInitial(i)) continue;
      if (i < loggedSets.length) {
        edits.push({ timestamp: loggedSets[i].timestamp, fields: toEntryFields(exercise, sets[i]) });
      } else {
        pendings.push({ setIdx: i, fields: toEntryFields(exercise, sets[i]) });
      }
    }
    if (edits.length === 0 && pendings.length === 0) { onClose(); return; }
    onSave(edits, pendings);
  };

  // Swipe-to-close (horizontal, with vertical threshold to not break scroll).
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 70 && Math.abs(dx) > dy * 1.3) persistAndClose();
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center"
      onClick={persistAndClose}
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
            onClick={persistAndClose}
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-slate-400 active:bg-slate-800 text-lg"
            aria-label="Закрыть"
          >✕</button>
        </div>

        {/* Set blocks */}
        <div className="flex flex-col gap-2">
          {Array.from({ length: N }, (_, i) => {
            const isLogged = i < loggedSets.length;
            return (
              <div
                key={i}
                className={`rounded-xl border p-3 ${
                  isLogged
                    ? "border-emerald-700/30 bg-slate-800/30"
                    : "border-slate-700 bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-slate-300">Rep {i + 1}</span>
                  {isLogged && (
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
                        type={f.type || "number"}
                        inputMode={f.inputMode}
                        step="any"
                        value={sets[i]?.[f.key] ?? ""}
                        onChange={e => update(i, f.key, e.target.value)}
                        className="h-11 px-3 rounded-lg bg-slate-900 border border-slate-700 text-base outline-none focus:border-amber-500 w-full"
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={persistAndClose}
          className="w-full h-12 rounded-xl bg-amber-500 text-slate-950 font-semibold active:bg-amber-400 mt-1"
        >
          Done
        </button>
      </div>
    </div>
  );
}
