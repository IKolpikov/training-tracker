// Pending set data: per-device value capture for sets the user has TYPED in the
// modal but NOT YET logged via [+] on the card.
//
// New mental model (locked with user):
//   - Card counter = sole truth of "done"; only [+]/[−] taps change it.
//   - Modal NEVER creates log rows. It edits already-logged sets and STASHES
//     values for future sets here. Next [+] tap pre-fills from pending.
// Storage: localStorage keyed by exercise + viewed date + set index (0-based).

const KEY = "pending_sets_v1";

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
  catch { return {}; }
}
function writeAll(obj) {
  try { localStorage.setItem(KEY, JSON.stringify(obj)); } catch { /* quota */ }
}

export function getPending(exId, dateStr, setIdx) {
  const all = readAll();
  return all?.[exId]?.[dateStr]?.[setIdx] || null;
}

export function setPending(exId, dateStr, setIdx, fields) {
  const all = readAll();
  if (!all[exId]) all[exId] = {};
  if (!all[exId][dateStr]) all[exId][dateStr] = {};
  all[exId][dateStr][setIdx] = fields;
  writeAll(all);
}

export function clearPending(exId, dateStr, setIdx) {
  const all = readAll();
  const day = all?.[exId]?.[dateStr];
  if (!day) return;
  delete day[setIdx];
  if (Object.keys(day).length === 0) {
    delete all[exId][dateStr];
    if (Object.keys(all[exId]).length === 0) delete all[exId];
  }
  writeAll(all);
}

// All pending entries for (exId, dateStr) as [{ setIdx, fields }], sorted by setIdx.
export function listPending(exId, dateStr) {
  const day = readAll()?.[exId]?.[dateStr] || {};
  return Object.keys(day)
    .map(k => ({ setIdx: Number(k), fields: day[k] }))
    .sort((a, b) => a.setIdx - b.setIdx);
}
