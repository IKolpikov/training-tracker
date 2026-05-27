// localStorage cache + offline write queue. Keys per PRD §7.5.

const K = {
  logsWeek: (w) => `logs_week_${w}`,
  queue: "write_queue",
};

export function getCachedWeekLogs(weekIso) {
  try { return JSON.parse(localStorage.getItem(K.logsWeek(weekIso))) || []; }
  catch { return []; }
}
export function setCachedWeekLogs(weekIso, rows) {
  localStorage.setItem(K.logsWeek(weekIso), JSON.stringify(rows));
}

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(K.queue)) || []; }
  catch { return []; }
}
export function pushQueue(entry) {
  const q = getQueue(); q.push(entry);
  localStorage.setItem(K.queue, JSON.stringify(q));
}
export function setQueue(q) {
  localStorage.setItem(K.queue, JSON.stringify(q));
}
