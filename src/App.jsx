import { useCallback, useEffect, useMemo, useState } from "react";
import { DayContext } from "./DayContext.jsx";
import {
  dateStr as toDateStr,
  getRussianDay,
  getWeekNumber,
  logicalNow,
  realTimestamp
} from "./utils/date.js";
import { loadWeek, logSetOptimistic, drainQueue, removeOptimistic } from "./services/sync.js";
import { fetchConfig, getCachedConfig, setCachedConfig } from "./services/config.js";
import { fetchAllLogs } from "./services/sheets.js";
import { setConfig as setConfigStore } from "./data/configStore.js";
import { useConfig } from "./useConfig.js";
import {
  cardioTargetToday,
  doneToday,
  strengthTargetToday
} from "./utils/progress.js";
import { habitLogId } from "./data/habits.js";
import {
  polzaLogId,
  isPolzaLog,
  polzaIdFromLog,
} from "./data/polza.js";
import DayHeader from "./components/DayHeader.jsx";
import ExerciseList from "./components/ExerciseList.jsx";
import ProgressBar from "./components/ProgressBar.jsx";
import MultiSetModal from "./components/MultiSetModal.jsx";
import TabBar from "./components/TabBar.jsx";
import HabitsView from "./components/HabitsView.jsx";
import PolzaView from "./components/PolzaView.jsx";
import UndoSnackbar from "./components/UndoSnackbar.jsx";

// Earliest date user can navigate to. History starts here.
const HISTORY_START = "2026-05-25";

export default function App() {
  // Live config from store (plan/schedule/habits/polza). Sheet is source of truth;
  // defaults seed bootstrap before fetch returns.
  const { exerciseById, schedule, habits, polzaById } = useConfig();
  const [configLoading, setConfigLoading] = useState(false);
  const [configError,   setConfigError]   = useState(null);

  const [viewedDate, setViewedDate] = useState(() => logicalNow());

  // ── logsMap: { [weekIso]: Log[] } ────────────────────────────────────────
  // Keeps data for every week we've visited in memory.
  // Navigating away and back to a week never loses optimistically-logged entries.
  const [logsMap, setLogsMap] = useState({});

  const [loading, setLoading]           = useState(true);
  const [multiSetExId, setMultiSetExId] = useState(null);

  // Tab navigation: "sport" | "habits" | "polza".
  const [activeTab, setActiveTab] = useState("sport");

  // Польза done-state is SERVER-DRIVEN (cross-device). polzaLog holds all-time
  // polza_* log rows as { id, date, timestamp }. Done/archive derives from this,
  // not from device-local storage. Optimistic entries added on tap, reconciled
  // on every refresh from the Log tab.
  const [polzaLog, setPolzaLog] = useState([]);

  // Undo snackbar state: { kind: "polza", id, timestamp } | null
  const [undoState, setUndoState] = useState(null);

  const dateStr = useMemo(() => toDateStr(viewedDate),     [viewedDate]);
  const day     = useMemo(() => getRussianDay(viewedDate), [viewedDate]);
  const weekIso = useMemo(() => getWeekNumber(viewedDate), [viewedDate]);

  // weekLogs for the currently viewed week — derived, never lost on navigation
  const weekLogs = logsMap[weekIso] || [];

  // ── helpers ───────────────────────────────────────────────────────────────
  // Merge server rows with optimistic entries not yet confirmed by the server.
  // Uses timestamp as dedup key so we never double-count.
  function mergeIntoMap(prev, iso, serverRows) {
    const existing  = prev[iso] || [];
    const serverTs  = new Set(serverRows.map(r => String(r.timestamp)));
    const optimistic = existing.filter(r => !serverTs.has(String(r.timestamp)));
    return { ...prev, [iso]: [...serverRows, ...optimistic] };
  }

  function addToMap(prev, iso, entries) {
    return { ...prev, [iso]: [...(prev[iso] || []), ...entries] };
  }

  function removeFromMap(prev, iso, timestamp) {
    return {
      ...prev,
      [iso]: (prev[iso] || []).filter(r => String(r.timestamp) !== String(timestamp)),
    };
  }

  // ── data loading ──────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await loadWeek(weekIso);
      // Preserve optimistic entries not yet on the server
      setLogsMap(prev => mergeIntoMap(prev, weekIso, rows));
    } finally {
      setLoading(false);
    }
  }, [weekIso]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── config loading (plan / habits / polza from sheet) ─────────────────────
  // Bootstrap order: hardcoded defaults (already in store) → cached → server.
  // Failure paths fall back gracefully; the app always renders SOMETHING.
  const refreshConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const fresh = await fetchConfig();
      setConfigStore(fresh);
      setCachedConfig(fresh);
    } catch (err) {
      setConfigError(String(err.message || err));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  // Pull all-time Польза done-state from the Log tab (cross-device source of truth).
  const refreshPolzaLog = useCallback(async () => {
    try {
      const all = await fetchAllLogs();
      setPolzaLog(
        all
          .filter(r => isPolzaLog(r.exercise_id))
          .map(r => ({
            id: polzaIdFromLog(r.exercise_id),
            date: String(r.date),
            timestamp: String(r.timestamp),
          }))
      );
    } catch { /* offline / failure → keep current optimistic state */ }
  }, []);

  // The ⟳ button refreshes both plan-config and Польза done-state.
  const refreshAll = useCallback(() => {
    refreshConfig();
    refreshPolzaLog();
  }, [refreshConfig, refreshPolzaLog]);

  useEffect(() => {
    const cached = getCachedConfig();
    if (cached) setConfigStore(cached);  // instant paint from cache
    refreshConfig();                      // then fetch fresh config
    refreshPolzaLog();                    // and Польза done-state
  }, [refreshConfig, refreshPolzaLog]);

  // Drain offline queue on tab focus / reconnect; also re-pull Польза state.
  useEffect(() => {
    const tryDrain = () =>
      drainQueue().then(() => { refresh(); refreshPolzaLog(); }).catch(() => {});
    window.addEventListener("focus",  tryDrain);
    window.addEventListener("online", tryDrain);
    return () => {
      window.removeEventListener("focus",  tryDrain);
      window.removeEventListener("online", tryDrain);
    };
  }, [refresh, refreshPolzaLog]);

  const dayLogs = useMemo(
    () => weekLogs.filter(r => String(r.date) === dateStr),
    [weekLogs, dateStr]
  );

  // ── navigation ────────────────────────────────────────────────────────────
  // History starts at HISTORY_START; future days are allowed (advance logging).
  // Disable ‹ when going back one more day would go before HISTORY_START.
  const prevDisabled = useMemo(() => {
    const d = new Date(viewedDate);
    d.setDate(d.getDate() - 1);
    return toDateStr(d) < HISTORY_START;
  }, [viewedDate]);

  const goPrev = () => setViewedDate(prev => {
    const d = new Date(prev); d.setDate(d.getDate() - 1);
    // Block navigation before history start
    return toDateStr(d) < HISTORY_START ? prev : d;
  });
  const goNext = () => setViewedDate(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + 1); return d;
  });

  // ── logging helpers ───────────────────────────────────────────────────────
  // Assembles a full Log-row. date/week_iso/day reflect the VIEWED date.
  // timestamp column A = real clock time (CLAUDE.md invariant).
  function buildEntry(ex, fields, setNumber) {
    return {
      timestamp:     realTimestamp(),
      date:          dateStr,
      week_iso:      weekIso,
      day,
      exercise_id:   ex.id,
      exercise_name: ex.name,
      set_number:    setNumber,
      reps: "", load: "", unit: "", notes: "",
      distance_km: "", duration_min: "", quality_min: "",
      ...fields
    };
  }

  // [+] button: log 1 set with defaults, no modal.
  const quickLog = (exId) => {
    const ex     = exerciseById[exId];
    const setNum = dayLogs.filter(r => r.exercise_id === exId).length + 1;
    let fields   = {};

    if (ex.type === "STR") {
      fields = { reps: ex.defaultReps ?? "", load: ex.defaultLoad ?? "", unit: ex.unit ?? "" };
    } else if (ex.type === "ISO") {
      fields = { reps: 1, load: ex.defaultLoad ?? "", unit: "sec" };
    } else {
      for (const f of ex.cardioFields || []) fields[f.key] = f.default ?? "";
    }

    const entry = buildEntry(ex, fields, setNum);
    logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, [entry]));
  };

  // Card tap: save all remaining sets from MultiSetModal.
  const saveMultipleSets = (entriesFields) => {
    const ex          = exerciseById[multiSetExId];
    const currentDone = dayLogs.filter(r => r.exercise_id === multiSetExId).length;

    const newLogs = entriesFields.map((fields, i) =>
      buildEntry(ex, fields, currentDone + i + 1)
    );

    for (const entry of newLogs) logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, newLogs));
    setMultiSetExId(null);
  };

  // Minus button: remove the last logged set for an exercise on the viewed day.
  // Removes from React state immediately; also cleans queue+cache for unsynced entries.
  // Already-synced entries reappear on the next server refresh (acceptable MVP trade-off).
  const removeLastSet = (exId) => {
    const entries = dayLogs.filter(r => r.exercise_id === exId);
    if (entries.length === 0) return;
    const last = entries[entries.length - 1];
    setLogsMap(prev => removeFromMap(prev, weekIso, last.timestamp));
    removeOptimistic(last.timestamp, weekIso);
  };

  // ── Habits ────────────────────────────────────────────────────────────────
  const logHabit = (id) => {
    const h = habits[id];
    if (!h) return;
    const entry = buildEntry({ id: habitLogId(id), name: h.name }, {}, 1);
    logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, [entry]));
  };

  const removeHabit = (id) => {
    const logId   = habitLogId(id);
    const entries = dayLogs.filter(r => r.exercise_id === logId);
    if (entries.length === 0) return;
    const last = entries[entries.length - 1];
    setLogsMap(prev => removeFromMap(prev, weekIso, last.timestamp));
    removeOptimistic(last.timestamp, weekIso);
  };

  // ── Польза ────────────────────────────────────────────────────────────────
  // Done-state lives in polzaLog (server-derived). We add an optimistic entry
  // immediately and the next refresh reconciles it with the Log tab.
  const logPolza = (id) => {
    const p = polzaById[id];
    if (!p) return;
    const entry = buildEntry({ id: polzaLogId(id), name: p.name }, {}, 1);
    logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, [entry]));
    setPolzaLog(prev => [...prev, { id, date: dateStr, timestamp: String(entry.timestamp) }]);
    setUndoState({ kind: "polza", id, timestamp: entry.timestamp });
  };

  const undoPolza = () => {
    if (!undoState || undoState.kind !== "polza") return;
    const { timestamp } = undoState;
    setLogsMap(prev => removeFromMap(prev, weekIso, timestamp));
    removeOptimistic(timestamp, weekIso);
    setPolzaLog(prev => prev.filter(e => e.timestamp !== String(timestamp)));
    setUndoState(null);
  };

  // Compute target + done for modal (relative to viewed day).
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
    quickLog, removeLastSet,
    openMultiSet: setMultiSetExId,
    refresh,
    goPrev, goNext, prevDisabled,
    // Habits + Польза
    logHabit, removeHabit,
    polzaLog, logPolza,
    // Config refresh (pull plan/habits/polza from sheet) + Польза done-state
    refreshConfig: refreshAll, configLoading, configError,
  };

  // Bottom padding: Sport view has fixed ProgressBar (h~88) + TabBar (h-14) above it.
  // Habits/Польза only have TabBar.
  const mainPb = activeTab === "sport" ? "pb-44" : "pb-20";

  return (
    <DayContext.Provider value={ctx}>
      <div className={`mx-auto max-w-[420px] min-h-full flex flex-col ${mainPb}`}>
        <DayHeader />
        <main className="flex-1 px-4 py-3">
          {activeTab === "sport"  && <ExerciseList />}
          {activeTab === "habits" && <HabitsView />}
          {activeTab === "polza"  && <PolzaView />}
        </main>

        {activeTab === "sport" && <ProgressBar />}

        <TabBar active={activeTab} onChange={setActiveTab} />

        {undoState && undoState.kind === "polza" && (
          <UndoSnackbar
            message={`Готово: ${polzaById[undoState.id]?.name || ""}`}
            onUndo={undoPolza}
            onDismiss={() => setUndoState(null)}
          />
        )}

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
