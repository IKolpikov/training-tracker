import { useCallback, useEffect, useMemo, useState } from "react";
import { DayContext } from "./DayContext.jsx";
import {
  dateStr as toDateStr,
  getRussianDay,
  getWeekNumber,
  logicalNow,
  realTimestamp
} from "./utils/date.js";
import { loadWeek, logSetOptimistic, drainQueue } from "./services/sync.js";
import { exerciseById } from "./data/plan.js";
import { schedule } from "./data/schedule.js";
import {
  cardioTargetToday,
  doneToday,
  strengthTargetToday
} from "./utils/progress.js";
import DayHeader from "./components/DayHeader.jsx";
import ExerciseList from "./components/ExerciseList.jsx";
import ProgressBar from "./components/ProgressBar.jsx";
import MultiSetModal from "./components/MultiSetModal.jsx";

export default function App() {
  // viewedDate is a logical Date (shifted by −4h). Default = logical today.
  const [viewedDate, setViewedDate] = useState(() => logicalNow());
  const [weekLogs, setWeekLogs]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [multiSetExId, setMultiSetExId] = useState(null);

  const dateStr = useMemo(() => toDateStr(viewedDate),       [viewedDate]);
  const day     = useMemo(() => getRussianDay(viewedDate),   [viewedDate]);
  const weekIso = useMemo(() => getWeekNumber(viewedDate),   [viewedDate]);

  // ── data loading ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loadWeek(weekIso);
      setWeekLogs(rows);
    } finally {
      setLoading(false);
    }
  }, [weekIso]);

  useEffect(() => { refresh(); }, [refresh]);

  // Drain offline queue on tab focus / reconnect
  useEffect(() => {
    const tryDrain = () => drainQueue().then(() => refresh()).catch(() => {});
    window.addEventListener("focus",  tryDrain);
    window.addEventListener("online", tryDrain);
    return () => {
      window.removeEventListener("focus",  tryDrain);
      window.removeEventListener("online", tryDrain);
    };
  }, [refresh]);

  const dayLogs = useMemo(
    () => weekLogs.filter(r => String(r.date) === dateStr),
    [weekLogs, dateStr]
  );

  // ── navigation ────────────────────────────────────────────────────────────
  // Future days are allowed — user sometimes logs ahead.
  const goPrev = () => setViewedDate(prev => {
    const d = new Date(prev); d.setDate(d.getDate() - 1); return d;
  });
  const goNext = () => setViewedDate(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + 1); return d;
  });

  // ── logging helpers ───────────────────────────────────────────────────────
  // Assembles a full Log-row object from exercise-specific fields.
  // date/week_iso/day always reflect the VIEWED date (supports retrospective & advance logging).
  // timestamp column A = real clock time (per CLAUDE.md invariant).
  function buildEntry(ex, fields, setNumber) {
    return {
      timestamp: realTimestamp(),
      date:      dateStr,
      week_iso:  weekIso,
      day,
      exercise_id:   ex.id,
      exercise_name: ex.name,
      set_number:    setNumber,
      // defaults for all Log columns; spread overwrites what's relevant
      reps: "", load: "", unit: "", notes: "",
      distance_km: "", duration_min: "", quality_min: "",
      ...fields
    };
  }

  // [+] button: immediately log 1 set with exercise defaults, no modal.
  const quickLog = (exId) => {
    const ex     = exerciseById[exId];
    const setNum = dayLogs.filter(r => r.exercise_id === exId).length + 1;
    let fields   = {};

    if (ex.type === "STR") {
      fields = { reps: ex.defaultReps ?? "", load: ex.defaultLoad ?? "", unit: ex.unit ?? "" };
    } else if (ex.type === "ISO") {
      fields = { reps: 1, load: ex.defaultLoad ?? "", unit: "sec" };
    } else {
      // CARDIO: fill from cardioFields defaults
      for (const f of ex.cardioFields || []) fields[f.key] = f.default ?? "";
    }

    const entry = buildEntry(ex, fields, setNum);
    logSetOptimistic(entry);
    setWeekLogs(prev => [...prev, entry]);
  };

  // Card tap: save all remaining sets from MultiSetModal in one go.
  const saveMultipleSets = (entriesFields) => {
    const ex          = exerciseById[multiSetExId];
    const currentDone = dayLogs.filter(r => r.exercise_id === multiSetExId).length;

    const newLogs = entriesFields.map((fields, i) =>
      buildEntry(ex, fields, currentDone + i + 1)
    );

    for (const entry of newLogs) logSetOptimistic(entry);
    setWeekLogs(prev => [...prev, ...newLogs]);
    setMultiSetExId(null);
  };

  // Compute target + done for the modal (based on viewed day, not logical today).
  const modalProps = useMemo(() => {
    if (!multiSetExId || !schedule[day]) return null;
    const isStrength = schedule[day].strength.includes(multiSetExId);
    const target = isStrength
      ? strengthTargetToday(multiSetExId, day, weekLogs)
      : cardioTargetToday(multiSetExId, day);
    const done = doneToday(multiSetExId, dateStr, dayLogs);
    return { target, done };
  }, [multiSetExId, day, weekLogs, dayLogs, dateStr]);

  // ── context ───────────────────────────────────────────────────────────────
  const ctx = {
    viewedDate, dateStr, day, weekIso,
    weekLogs, dayLogs, loading,
    quickLog,
    openMultiSet: setMultiSetExId,
    refresh,
    goPrev, goNext,
  };

  return (
    <DayContext.Provider value={ctx}>
      <div className="mx-auto max-w-[420px] min-h-full flex flex-col pb-20">
        <DayHeader />
        <main className="flex-1 px-4 py-3">
          <ExerciseList />
        </main>
        <ProgressBar />

        {multiSetExId && modalProps && (
          <MultiSetModal
            exercise={exerciseById[multiSetExId]}
            target={modalProps.target}
            done={modalProps.done}
            onClose={() => setMultiSetExId(null)}
            onSave={saveMultipleSets}
          />
        )}
      </div>
    </DayContext.Provider>
  );
}
