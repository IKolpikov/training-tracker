// Talks to the Apps Script Web App. Read logs (GET) + append log (POST).
// CORS: POST sends Content-Type text/plain to avoid preflight; body is JSON.

const API_URL = import.meta.env.VITE_API_URL; // Apps Script /exec URL

export async function fetchWeekLogs(weekIso) {
  const res = await fetch(`${API_URL}?action=logs&week=${weekIso}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "fetch logs failed");
  return data.rows; // array of Log row objects
}

// Fetch a config tab from the sheet. Returns raw row array (callers re-shape).
async function fetchConfigTab_(action) {
  const res = await fetch(`${API_URL}?action=${action}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || `fetch ${action} failed`);
  return data.rows;
}

export const fetchPlanRows   = () => fetchConfigTab_("plan");
export const fetchHabitsRows = () => fetchConfigTab_("habits");
export const fetchPolzaRows  = () => fetchConfigTab_("polza");

// entry: object keyed by Log headers (timestamp, date, week_iso, day, exercise_id, ...)
export async function appendLog(entry) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" }, // skip CORS preflight
    body: JSON.stringify(entry)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "append failed");
  return true;
}
