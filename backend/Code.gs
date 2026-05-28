/**
 * Training Tracker backend — Google Apps Script Web App.
 * Deploy: Extensions > Apps Script (from the target Sheet) OR standalone with SHEET_ID below.
 * Deploy as: Web app, Execute as = Me, Who has access = Anyone.
 * Copy the /exec URL into the frontend .env (VITE_API_URL).
 *
 * CORS note: browser fetch must send Content-Type text/plain to skip preflight
 * (Apps Script web apps don't answer OPTIONS). Body is still JSON, parsed server-side.
 *
 * Two sheet IDs:
 *   SHEET_ID         — Log tab (read history + append new entries).
 *   CONFIG_SHEET_ID  — Plan/Habits/Польза tabs (read-only).
 * Set them to the same value if you keep everything in one file.
 */

// Single-file setup: Log + plan/habits/polza all live in the same spreadsheet.
const SHEET_ID        = "1t_YwNTPT64YV-5lfMH5lIN-eypeiNIaZKB13IRcCDYk";
const CONFIG_SHEET_ID = "1t_YwNTPT64YV-5lfMH5lIN-eypeiNIaZKB13IRcCDYk";

const LOG_TAB     = "Log";
const PLAN_TAB    = "Week Plan May 2026";
const HABITS_TAB  = "Habbits";
const POLZA_TAB   = "Польза";

const HEADERS  = [
  "timestamp","date","week_iso","day","exercise_id","exercise_name",
  "set_number","reps","load","unit","notes","distance_km","duration_min","quality_min"
];

function getLogSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(LOG_TAB);
    sh.appendRow(HEADERS);
  }
  return sh;
}

function getConfigSheet_(tabName) {
  const ss = SpreadsheetApp.openById(CONFIG_SHEET_ID);
  const sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error("Config tab not found: " + tabName);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Normalize a Log-tab cell value. Sheets auto-parses dates back to Date objects;
 * we convert them back to the string format the frontend expects.
 */
function normalizeCell_(header, value) {
  if (value === "" || value === null || value === undefined) return "";

  if (value instanceof Date) {
    if (header === "date") {
      return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
    }
    if (header === "timestamp") {
      return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
    }
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
  }

  if (header === "week_iso" && value !== "") {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }

  return value;
}

/**
 * Generic header-keyed reader: trims headers, returns array of row objects.
 * Looks up cells by header NAME so the user can reorder columns freely.
 */
function readTabRows_(tabName) {
  const sh = getConfigSheet_(tabName);
  const values = sh.getDataRange().getValues();
  if (values.length === 0) return [];

  const headers = values.shift().map(h => String(h || "").trim());
  return values.map(row => {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i]; });
    return o;
  }).filter(o => {
    // Skip empty rows (all cells blank).
    return Object.values(o).some(v => v !== "" && v !== null && v !== undefined);
  });
}

// Strip trailing whitespace, return "" for null/undefined.
function s_(v) { return String(v == null ? "" : v).trim(); }
// Coerce to number; "" / non-numeric -> null.
function n_(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ── GET dispatch ────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter.action || "logs");
    if (action === "logs")   return getLogs_(e);
    if (action === "plan")   return getPlan_();
    if (action === "habits") return getHabits_();
    if (action === "polza")  return getPolza_();
    return json_({ ok: false, error: "unknown action: " + action });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function getLogs_(e) {
  const sh     = getLogSheet_();
  const values = sh.getDataRange().getValues();
  const head   = values.shift() || HEADERS;

  let rows = values.map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = normalizeCell_(h, r[i]); });
    return o;
  });

  const week = e.parameter.week;
  if (week) rows = rows.filter(r => String(r.week_iso) === String(week));

  return json_({ ok: true, rows: rows });
}

// Week Plan: columns id | Day | Type | Name | Sets | Reps | Unit | Load | Load unit | Notes
//   Type: "STR routine" | "Cardio". ISO is inferred from Unit="seconds".
function getPlan_() {
  const rows = readTabRows_(PLAN_TAB);
  const out = rows.map(r => ({
    id:        s_(r["id"]),
    day:       s_(r["Day"]),
    type:      s_(r["Type"]),
    name:      s_(r["Name"]),
    sets:      n_(r["Sets"]),
    reps:      n_(r["Reps"]),
    unit:      s_(r["Unit"]),
    load:      n_(r["Load"]),
    load_unit: s_(r["Load unit"]),
    notes:     s_(r["Notes"]),
  })).filter(r => r.id && r.day);
  return json_({ ok: true, rows: out });
}

// Habbits: columns id | День | Рутина
function getHabits_() {
  const rows = readTabRows_(HABITS_TAB);
  const out = rows.map(r => ({
    id:   s_(r["id"]),
    day:  s_(r["День"]),
    name: s_(r["Рутина"]),
  })).filter(r => r.id && r.day);
  return json_({ ok: true, rows: out });
}

// Польза: columns id | name (or any 2 columns, second one is treated as name)
function getPolza_() {
  const rows = readTabRows_(POLZA_TAB);
  // Find the "name"-like column: anything not "id".
  const sample = rows[0] || {};
  const nameKey = Object.keys(sample).find(k => k.toLowerCase() !== "id") || "name";
  const out = rows.map(r => ({
    id:   s_(r["id"]),
    name: s_(r[nameKey]),
  })).filter(r => r.id && r.name);
  return json_({ ok: true, rows: out });
}

// POST body = single Log entry (object keyed by HEADERS). Appends one row.
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sh   = getLogSheet_();
    const row  = HEADERS.map(h => (body[h] !== undefined && body[h] !== null) ? body[h] : "");
    sh.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
