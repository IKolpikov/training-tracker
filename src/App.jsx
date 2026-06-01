import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DayContext } from "./DayContext.jsx";
import {
  dateStr as toDateStr,
  getRussianDay,
  getWeekNumber,
  logicalNow,
  realTimestamp
} from "./utils/date.js";
import {
  loadWeek, logSetOptimistic, drainQueue, removeOptimistic, applyEditOptimistic,
} from "./services/sync.js";
import { getCachedWeekLogs } from "./services/cache.js";
import { fetchConfig, getCachedConfig, setCachedConfig } from "./services/config.js";
import { fetchAllLogs, addPolzaTask } from "./services/sheets.js";
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
import {
  getPending, setPending, clearPending, listPending,
} from "./services/pending.js";
import DayHeader from "./components/DayHeader.jsx";
import ExerciseList from "./components/ExerciseList.jsx";
import ProgressBar from "./components/ProgressBar.jsx";
import MultiSetModal from "./components/MultiSetModal.jsx";
import TabBar from "./components/TabBar.jsx";
import HabitsView from "./components/HabitsView.jsx";
import PolzaView from "./components/PolzaView.jsx";
import AddPolzaModal from "./components/AddPolzaModal.jsx";
import UndoSnackbar from "./components/UndoSnackbar.jsx";

// Earliest date user can navigate to. History starts here.
const HISTORY_START = "2026-05-25";

export default function App() {
  // Live config from store (plan/schedule/habits/polza). Sheet is source of truth;
  // defaults seed bootstrap before fetch returns.
  const { exerciseById, schedule, habits, polzaById } = useConfig();
  const [configLoading, setConfigLoading] = useState(false);
  const [configError,   setConfigError]   = useState(null);
  // Persistent backend-connection status: null (never) | {ok:true} | {ok:false, error}
  const [lastSync,      setLastSync]      = useState(null);

  const [viewedDate, setViewedDate] = useState(() => logicalNow());

  // ── logsMap: { [weekIso]: Log[] } ────────────────────────────────────────
  // Keeps data for every week we've visited in memory.
  // Cache-first bootstrap: prime with the current week's cached rows so the
  // first render shows last-known data (no [0/2] flash) instead of empty.
  const [logsMap, setLogsMap] = useState(() => {
    const w = getWeekNumber(logicalNow());
    const cached = getCachedWeekLogs(w);
    return cached.length ? { [w]: cached } : {};
  });

  const [loading, setLoading]           = useState(true);
  const [multiSetExId, setMultiSetExId] = useState(null);
  const [addPolzaOpen, setAddPolzaOpen] = useState(false);

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
      return fresh;  // caller checks for real (non-empty) data
    } catch (err) {
      setConfigError(String(err.message || err));
      return null;
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

  // Drive the offline queue to the backend and record the real result.
  // lastSync turns green ONLY when a write/delete actually landed on the server.
  const commitSync = useCallback(async () => {
    try {
      const res = await drainQueue();
      if ((res.appended + res.deleted) > 0) {
        setLastSync(res.ok ? { ok: true } : { ok: false, error: "запись не ушла на сервер" });
      } else if (res.failed > 0) {
        setLastSync({ ok: false, error: "сервер недоступен" });
      }
    } catch (e) {
      setLastSync({ ok: false, error: String(e.message || e) });
    }
  }, []);

  // The ⟳ button: flush pending writes, then RE-PULL everything authoritative —
  // current week's sport logs (loadWeek), Польза done-state, and plan-config.
  // Order matters: drain first so our own writes are on the server before we
  // re-read, then loadWeek reconciles sport counts across devices.
  // Green when the backend answered with real data OR a queued write landed.
  const refreshAll = useCallback(async () => {
    let wrote = { appended: 0, deleted: 0, failed: 0, ok: true };
    try { wrote = await drainQueue(); } catch { wrote.ok = false; }
    await refresh();          // re-pull current week's logs → sport counts reconcile
    refreshPolzaLog();        // re-pull Польза done-state
    const fresh = await refreshConfig();
    const gotRealData    = !!fresh && Array.isArray(fresh.exercises) && fresh.exercises.length > 0;
    const wroteSomething = wrote.ok && (wrote.appended + wrote.deleted) > 0;
    if (gotRealData || wroteSomething) setLastSync({ ok: true });
    else setLastSync({ ok: false, error: "сервер не ответил данными" });
  }, [refresh, refreshConfig, refreshPolzaLog]);

  useEffect(() => {
    const cached = getCachedConfig();
    if (cached) setConfigStore(cached);  // instant paint from cache
    refreshAll();                         // fetch fresh + flash ✓ on real exchange
  }, [refreshAll]);

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
  // timestamp column A = real clock time (CLAUDE.md invariant); pass an explicit
  // one for batch writes so each row gets a unique key.
  function buildEntry(ex, fields, setNumber, timestamp) {
    return {
      timestamp:     timestamp || realTimestamp(),
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

  // [+] button: log 1 set. Uses pending values for this slot if the user typed
  // them in the modal earlier; otherwise plan defaults.
  const quickLog = (exId) => {
    const ex      = exerciseById[exId];
    const done    = dayLogs.filter(r => r.exercise_id === exId).length;
    const setNum  = done + 1;
    const pending = getPending(exId, dateStr, done); // pending is 0-indexed by setIdx

    let fields = {};
    if (pending) {
      fields = pending;
    } else if (ex.type === "STR") {
      fields = { reps: ex.defaultReps ?? "", load: ex.defaultLoad ?? "", unit: ex.unit ?? "" };
    } else if (ex.type === "ISO") {
      fields = { reps: 1, load: ex.defaultLoad ?? "", unit: "sec" };
    } else {
      for (const f of ex.cardioFields || []) fields[f.key] = f.default ?? "";
    }

    const entry = buildEntry(ex, fields, setNum);
    logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, [entry]));
    if (pending) clearPending(exId, dateStr, done);
    commitSync();
  };

  // Save from MultiSetModal under the NEW model:
  //   edits    — [{ timestamp, fields }] for already-logged sets the user actually edited.
  //              Patched IN PLACE via update endpoint (no delete+append race, no data loss).
  //   pendings — [{ setIdx, fields }] for not-yet-logged sets the user typed values into.
  //              Stashed in localStorage; consumed by the next [+] tap on the card.
  //   The modal NEVER creates log rows. Card counter is the sole source of "done".
  const saveMultipleSets = (edits = [], pendings = []) => {
    const exId = multiSetExId;

    // 1. Patch edited rows everywhere (cache + queue + server update queue).
    for (const e of edits) applyEditOptimistic(e.timestamp, weekIso, e.fields);
    if (edits.length) {
      const editPatch = new Map(edits.map(e => [String(e.timestamp), e.fields]));
      setLogsMap(prev => ({
        ...prev,
        [weekIso]: (prev[weekIso] || []).map(r => {
          const patch = editPatch.get(String(r.timestamp));
          return patch ? { ...r, ...patch } : r;
        }),
      }));
    }

    // 2. Stash pending values for future sets.
    for (const p of pendings) setPending(exId, dateStr, p.setIdx, p.fields);

    setMultiSetExId(null);
    if (edits.length) commitSync();
  };

  // Minus button: remove the last logged set for an exercise on the viewed day.
  // The card's invisible left-edge button + a long-press requirement guards against
  // accidental taps. We ALSO stash the removed row + show an Undo snackbar so an
  // accidental delete is recoverable for 5 seconds.
  const removeLastSet = (exId) => {
    const entries = dayLogs.filter(r => r.exercise_id === exId);
    if (entries.length === 0) return;
    const last = entries[entries.length - 1];
    setLogsMap(prev => removeFromMap(prev, weekIso, last.timestamp));
    removeOptimistic(last.timestamp, weekIso);
    setUndoState({ kind: "set", exId, entry: last, timestamp: last.timestamp });
    commitSync();
  };

  // Restore a just-removed set (Undo). Re-append it locally + on the server.
  const undoRemoveLastSet = () => {
    if (!undoState || undoState.kind !== "set") return;
    const { entry } = undoState;
    logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, [entry]));
    setUndoState(null);
    commitSync();
  };

  // ── Habits ────────────────────────────────────────────────────────────────
  const logHabit = (id) => {
    const h = habits[id];
    if (!h) return;
    const entry = buildEntry({ id: habitLogId(id), name: h.name }, {}, 1);
    logSetOptimistic(entry);
    setLogsMap(prev => addToMap(prev, weekIso, [entry]));
    commitSync();
  };

  // Same shape as removeLastSet, just with the habit_*-prefixed exId.
  const removeHabit = (id) => removeLastSet(habitLogId(id));

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
    commitSync();
  };

  const undoPolza = () => {
    if (!undoState || undoState.kind !== "polza") return;
    const { timestamp } = undoState;
    setLogsMap(prev => removeFromMap(prev, weekIso, timestamp));
    removeOptimistic(timestamp, weekIso);
    setPolzaLog(prev => prev.filter(e => e.timestamp !== String(timestamp)));
    setUndoState(null);
    commitSync();
  };

  // Compute target + done + logged entries + pending typed-for-future for the modal.
  const modalProps = useMemo(() => {
    if (!multiSetExId || !schedule[day]) return null;
    const isStrength = schedule[day].strength.includes(multiSetExId);
    const target = isStrength
      ? strengthTargetToday(multiSetExId, day, weekLogs)
      : cardioTargetToday(multiSetExId, day);
    const done = doneToday(multiSetExId, dateStr, dayLogs);
    const entries = dayLogs.filter(r => r.exercise_id === multiSetExId);
    const pendings = listPending(multiSetExId, dateStr);
    return { target, done, entries, pendings };
  }, [multiSetExId, day, weekLogs, dayLogs, dateStr]);

  // ── context ───────────────────────────────────────────────────────────────
  const ctx = {
    viewedDate, dateStr, day, weekIso,
    weekLogs, dayLogs, loading,
    quickLog, removeLastSet, undoRemoveLastSet,
    openMultiSet: setMultiSetExId,
    refresh,
    goPrev, goNext, prevDisabled,
    // Habits + Польза
    logHabit, removeHabit,
    polzaLog, logPolza,
    openAddPolza: () => setAddPolzaOpen(true),
    // Config refresh (pull plan/habits/polza from sheet) + Польза done-state
    refreshConfig: refreshAll, configLoading, configError, lastSync,
  };

  // Bottom padding: Sport view has fixed ProgressBar (h~88) + TabBar (h-14) above it.
  // Habits/Польза only have TabBar.
  const mainPb = activeTab === "sport" ? "pb-44" : "pb-20";

  // ── horizontal swipe between days (mobile) ────────────────────────────────
  // Triggers only on a strongly-horizontal gesture so vertical scrolling stays
  // intact. Threshold tuned so accidental sub-50px drags don't change day.
  const swipeStart = useRef(null);
  const onContentTouchStart = (e) => {
    const t = e.touches[0];
    swipeStart.current = { x: t.clientX, y: t.clientY };
  };
  const onContentTouchEnd = (e) => {
    const s = swipeStart.current;
    if (!s) return;
    swipeStart.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = Math.abs(t.clientY - s.y);
    if (Math.abs(dx) < 60) return;
    if (Math.abs(dx) <= dy * 1.3) return; // mostly vertical — let scroll win
    if (dx < 0) goNext();                  // swipe left → next day
    else if (!prevDisabled) goPrev();      // swipe right → previous day
  };

  return (
    <DayContext.Provider value={ctx}>
      <div className={`mx-auto max-w-[420px] min-h-full flex flex-col ${mainPb}`}>
        <DayHeader />
        <main
          className="flex-1 px-4 py-3"
          onTouchStart={onContentTouchStart}
          onTouchEnd={onContentTouchEnd}
        >
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

        {undoState && undoState.kind === "set" && (
          <UndoSnackbar
            message="Сет удалён"
            onUndo={undoRemoveLastSet}
            onDismiss={() => setUndoState(null)}
          />
        )}

        {addPolzaOpen && (
          <AddPolzaModal
            onClose={() => setAddPolzaOpen(false)}
            onSubmit={async (name) => {
              await addPolzaTask(name);
              await refreshConfig();   // pull new task from sheet
            }}
          />
        )}

        {multiSetExId && modalProps && (
          <MultiSetModal
            exercise={exerciseById[multiSetExId]}
            target={modalProps.target}
            done={modalProps.done}
            loggedSets={modalProps.entries}
            pendingSets={modalProps.pendings}
            onClose={() => setMultiSetExId(null)}
            onSave={saveMultipleSets}
          />
        )}
      </div>
    </DayContext.Provider>
  );
}
