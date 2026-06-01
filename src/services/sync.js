// Offline sync. Optimistic UI writes to queue+cache immediately, then drains queue.
// Every mutation (append AND delete) is mirrored to the backend; deletes that can't
// reach the server right now sit in delete_queue and flush on the next drain.

import { appendLog, deleteLog, updateLog, fetchWeekLogs } from "./sheets.js";
import {
  getQueue, setQueue, pushQueue,
  getDeleteQueue, setDeleteQueue, pushDeleteQueue,
  getUpdateQueue, setUpdateQueue, pushUpdateQueue,
  getCachedWeekLogs, setCachedWeekLogs
} from "./cache.js";

// Called on Save: write to cache + queue right away (optimistic).
// Does NOT auto-drain — the caller drives the drain (via commitSync) so it can
// observe the real server result and confirm the exchange in the UI.
export function logSetOptimistic(entry) {
  const week = entry.week_iso;
  const merged = [...getCachedWeekLogs(week), entry];
  setCachedWeekLogs(week, merged);
  pushQueue(entry);
  return merged;
}

// Guard against concurrent drains (action + focus/online could race → double POST).
let _draining = false;

// Walk one queue serially; failed items stay for the next drain.
async function flushQueue_(get, set, send) {
  const q = get();
  const remaining = [];
  let done = 0, failed = 0;
  for (const item of q) {
    try { await send(item); done++; }
    catch { remaining.push(item); failed++; }
  }
  set(remaining);
  return { done, failed };
}

// Flush queued writes, updates, and deletes. Returns real outcome:
//   { appended, updated, deleted, failed, ok } — ok=true only if nothing failed.
// A genuine server exchange happened iff (appended + updated + deleted) > 0 && ok.
// Updates run BEFORE deletes — patching a soon-to-be-deleted row is harmless,
// but deleting before patching would silently skip the update.
export async function drainQueue() {
  if (_draining) return { appended: 0, updated: 0, deleted: 0, failed: 0, ok: true, skipped: true };
  _draining = true;
  try {
    const a = await flushQueue_(getQueue,       setQueue,       appendLog);
    const u = await flushQueue_(getUpdateQueue, setUpdateQueue, (i) => updateLog(i.timestamp, i.fields));
    const d = await flushQueue_(getDeleteQueue, setDeleteQueue, deleteLog);
    const failed = a.failed + u.failed + d.failed;
    return { appended: a.done, updated: u.done, deleted: d.done, failed, ok: failed === 0 };
  } finally {
    _draining = false;
  }
}

// Remove one entry everywhere: local cache + write queue, and the SERVER.
// If still in the write queue (never synced), pulling it from the queue is enough.
// If already sent, enqueue a server-side delete. Caller drives the drain.
export function removeOptimistic(timestamp, weekIso) {
  const ts = String(timestamp);
  const q = getQueue();
  const wasUnsynced = q.some(e => String(e.timestamp) === ts);

  setQueue(q.filter(e => String(e.timestamp) !== ts));
  setCachedWeekLogs(weekIso, getCachedWeekLogs(weekIso).filter(r => String(r.timestamp) !== ts));

  if (!wasUnsynced) pushDeleteQueue(ts); // already on server → must delete there too
  return { wasUnsynced };
}

// Patch an existing log row in place (e.g. edit reps/load of an already-logged set).
// Updates cache, in-flight queue entries (if any), and enqueues a server update.
// CRITICAL: this REPLACES the old delete+append edit flow, which had a race where
// a failed append + successful delete = silently lost row.
export function applyEditOptimistic(timestamp, weekIso, fields) {
  const ts = String(timestamp);

  // Patch any still-queued append for this row.
  const q = getQueue();
  const wasUnsynced = q.some(e => String(e.timestamp) === ts);
  if (wasUnsynced) {
    setQueue(q.map(e => String(e.timestamp) === ts ? { ...e, ...fields } : e));
  }

  // Patch cache.
  setCachedWeekLogs(
    weekIso,
    getCachedWeekLogs(weekIso).map(r => String(r.timestamp) === ts ? { ...r, ...fields } : r)
  );

  // If the row had already reached the server, queue a server-side patch.
  if (!wasUnsynced) pushUpdateQueue(ts, fields);
  return { wasUnsynced };
}

// On open / week change: pull authoritative rows, merge unsynced queue on top (no dupes).
export async function loadWeek(weekIso) {
  let rows;
  try {
    rows = await fetchWeekLogs(weekIso);
    setCachedWeekLogs(weekIso, rows);
  } catch {
    rows = getCachedWeekLogs(weekIso); // offline fallback
  }
  // Add only queue entries whose timestamp isn't already in rows
  // (prevents doubling when cache + queue both hold the same entry)
  const seen = new Set(rows.map(r => String(r.timestamp)));
  const pending = getQueue()
    .filter(e => String(e.week_iso) === String(weekIso))
    .filter(e => !seen.has(String(e.timestamp)));
  return [...rows, ...pending];
}
