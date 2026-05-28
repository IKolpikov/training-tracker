// Offline sync. Optimistic UI writes to queue+cache immediately, then drains queue.
// Every mutation (append AND delete) is mirrored to the backend; deletes that can't
// reach the server right now sit in delete_queue and flush on the next drain.

import { appendLog, deleteLog, fetchWeekLogs } from "./sheets.js";
import {
  getQueue, setQueue, pushQueue,
  getDeleteQueue, setDeleteQueue, pushDeleteQueue,
  getCachedWeekLogs, setCachedWeekLogs
} from "./cache.js";

// Called on Save: write to cache + queue right away (optimistic), fire-and-forget drain.
export function logSetOptimistic(entry) {
  const week = entry.week_iso;
  const merged = [...getCachedWeekLogs(week), entry];
  setCachedWeekLogs(week, merged);
  pushQueue(entry);
  drainQueue().catch(() => {}); // retry happens on next action/open
  return merged;
}

// Try to flush every queued write AND queued delete. Remove from queues on success.
export async function drainQueue() {
  // Appends
  const q = getQueue();
  const remaining = [];
  for (const entry of q) {
    try { await appendLog(entry); }
    catch { remaining.push(entry); }
  }
  setQueue(remaining);

  // Deletes
  const dq = getDeleteQueue();
  const dRemaining = [];
  for (const ts of dq) {
    try { await deleteLog(ts); }
    catch { dRemaining.push(ts); }
  }
  setDeleteQueue(dRemaining);

  return remaining.length === 0 && dRemaining.length === 0;
}

// Remove one entry everywhere: local cache + write queue, and the SERVER.
// If the entry was still in the write queue (never synced), pulling it from the
// queue is enough. If it had already been sent, we enqueue a server-side delete.
export function removeOptimistic(timestamp, weekIso) {
  const ts = String(timestamp);
  const q = getQueue();
  const wasUnsynced = q.some(e => String(e.timestamp) === ts);

  setQueue(q.filter(e => String(e.timestamp) !== ts));
  setCachedWeekLogs(weekIso, getCachedWeekLogs(weekIso).filter(r => String(r.timestamp) !== ts));

  if (!wasUnsynced) {
    pushDeleteQueue(ts);          // already on the server → must delete there too
    drainQueue().catch(() => {}); // fire-and-forget; retries on next action/focus
  }
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
