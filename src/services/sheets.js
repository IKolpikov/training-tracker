// Talks to the Apps Script Web App. Read logs (GET) + append/update/delete log (POST).
// CORS: POST sends Content-Type text/plain to avoid preflight; body is JSON.

const API_URL = import.meta.env.VITE_API_URL; // Apps Script /exec URL

// Shared POST: text/plain skips CORS preflight; body is JSON. Throws on !ok.
async function postAction_(body, label) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || `${label} failed`);
  return data;
}

async function getAction_(action, label, qs = "") {
  const res = await fetch(`${API_URL}?action=${action}${qs}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || `fetch ${label} failed`);
  return data;
}

export const fetchWeekLogs   = (weekIso) => getAction_("logs", "logs", `&week=${weekIso}`).then(d => d.rows);
export const fetchAllLogs    = ()        => getAction_("logs", "logs").then(d => d.rows);
export const fetchPlanRows   = ()        => getAction_("plan",   "plan").then(d => d.rows);
export const fetchHabitsRows = ()        => getAction_("habits", "habits").then(d => d.rows);
export const fetchPolzaRows  = ()        => getAction_("polza",  "polza").then(d => d.rows);

// entry: object keyed by Log headers (timestamp, date, week_iso, day, exercise_id, ...)
export const appendLog = (entry)          => postAction_(entry, "append").then(() => true);
export const deleteLog = (timestamp)      => postAction_({ action: "delete", timestamp }, "delete").then(() => true);
export const updateLog = (timestamp, f)   => postAction_({ action: "update", timestamp, fields: f }, "update").then(() => true);
export const addPolzaTask = (name)        => postAction_({ action: "addPolza", name }, "addPolza").then(d => ({ id: d.id, name: d.name }));
