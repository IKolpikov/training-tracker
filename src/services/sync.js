// Offline sync. Optimistic UI writes to queue+cache immediately, then drains queue.
// Every mutation (append AND delete) is mirrored to the backend; deletes that can't
// reach the server right now sit in delete_queue and flush on the next drain.

import { appendLog, deleteLog, fetchWeekLogs } from "./sheets.js";
import {
  getQueue, setQueue, pushQueue,
  getDeleteQueue, setDeleteQueue, pushDeleteQueue,
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

// Flush every queued write AND queued delete. Returns real outcome:
//   { appended, deleted, failed, ok } — ok=true only if nothing failed.
// A genuine server exchange happened iff (appended + deleted) > 0 && ok.
export async function drainQueue() {
  if (_draining) return { appended: 0, deleted: 0, failed: 0, ok: true, skipped: true };
  _draining = true;
  try {
    let appended = 0, deleted = 0, failed = 0;

    const q = getQueue();
    const remaining = [];
    for (const entry of q) {
      try { await appendLog(entry); appended++; }
      catch { remaining.push(entry); failed++; }
    }
    setQueue(remaining);

    const dq = getDeleteQueue();
    const dRemaining = [];
    for (const ts of dq) {
      try { await deleteLog(ts); deleted++; }
      catch { dRemaining.push(ts); failed++; }
    }
    setDeleteQueue(dRemaining);

    return { appended, deleted, failed, ok: failed === 0 };
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
