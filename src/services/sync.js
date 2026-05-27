// Offline sync. Optimistic UI writes to queue+cache immediately, then drains queue.

import { appendLog, fetchWeekLogs } from "./sheets.js";
import { getQueue, setQueue, pushQueue, getCachedWeekLogs, setCachedWeekLogs } from "./cache.js";

// Called on Save: write to cache + queue right away (optimistic), fire-and-forget drain.
export function logSetOptimistic(entry) {
  const week = entry.week_iso;
  const merged = [...getCachedWeekLogs(week), entry];
  setCachedWeekLogs(week, merged);
  pushQueue(entry);
  drainQueue().catch(() => {}); // retry happens on next action/open
  return merged;
}

// Try to flush every queued write. Remove from queue on success.
export async function drainQueue() {
  const q = getQueue();
  const remaining = [];
  for (const entry of q) {
    try { await appendLog(entry); }
    catch { remaining.push(entry); } // keep for next attempt
  }
  setQueue(remaining);
  return remaining.length === 0;
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
