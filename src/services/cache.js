// localStorage cache + offline queues. Three queues share one factory.

const K = {
  logsWeek: (w) => `logs_week_${w}`,
};

export function getCachedWeekLogs(weekIso) {
  try { return JSON.parse(localStorage.getItem(K.logsWeek(weekIso))) || []; }
  catch { return []; }
}
export function setCachedWeekLogs(weekIso, rows) {
  localStorage.setItem(K.logsWeek(weekIso), JSON.stringify(rows));
}

// Generic queue backed by localStorage. coalesce(prev, next) optionally merges
// items with the same key (used by update queue to fold patches per timestamp).
function makeQueue(key, { coalesce } = {}) {
  const get = () => {
    try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
  };
  const set = (q) => localStorage.setItem(key, JSON.stringify(q));
  const push = (item) => {
    const q = get();
    if (coalesce) {
      const i = coalesce.findIndex(q, item);
      if (i >= 0) { q[i] = coalesce.merge(q[i], item); set(q); return; }
    }
    q.push(item);
    set(q);
  };
  return { get, set, push };
}

const write  = makeQueue("write_queue");
const remove = makeQueue("delete_queue");
const update = makeQueue("update_queue", {
  coalesce: {
    findIndex: (q, item) => q.findIndex(u => String(u.timestamp) === String(item.timestamp)),
    merge:     (a, b)    => ({ timestamp: String(b.timestamp), fields: { ...a.fields, ...b.fields } }),
  },
});

// Write queue (pending appendLog entries).
export const getQueue    = write.get;
export const setQueue    = write.set;
export const pushQueue   = (entry) => write.push(entry);

// Delete queue (timestamps of synced rows pending server-side deletion).
export const getDeleteQueue  = remove.get;
export const setDeleteQueue  = remove.set;
export const pushDeleteQueue = (ts) => remove.push(String(ts));

// Update queue ({timestamp, fields} patches; merged per timestamp).
export const getUpdateQueue  = update.get;
export const setUpdateQueue  = update.set;
export const pushUpdateQueue = (timestamp, fields) =>
  update.push({ timestamp: String(timestamp), fields });
