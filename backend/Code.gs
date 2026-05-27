/**
 * Training Tracker backend — Google Apps Script Web App.
 * Deploy: Extensions > Apps Script (from the target Sheet) OR standalone with SHEET_ID below.
 * Deploy as: Web app, Execute as = Me, Who has access = Anyone.
 * Copy the /exec URL into the frontend .env (VITE_API_URL).
 *
 * CORS note: browser fetch must send Content-Type text/plain to skip preflight
 * (Apps Script web apps don't answer OPTIONS). Body is still JSON, parsed server-side.
 */

const SHEET_ID = "1lyS3o-XYav5KDUyvxz5uCxPADEmUir1lea2tTD8D59g";
const LOG_TAB  = "Log";
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Normalize a raw cell value from getValues().
 * Google Sheets auto-parses "2026-05-25" into a Date object.
 * We convert it back to the string format the frontend expects.
 */
function normalizeCell_(header, value) {
  if (value === "" || value === null || value === undefined) return "";

  if (value instanceof Date) {
    if (header === "date") {
      // Must match frontend dateStr format: "YYYY-MM-DD"
      return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
    }
    if (header === "timestamp") {
      // Must match frontend realTimestamp() format: "YYYY-MM-DDTHH:mm:ss"
      return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
    }
    // Fallback for any other date-like cell
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
  }

  // week_iso: always return as number so frontend Number comparison works
  if (header === "week_iso" && value !== "") {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }

  return value;
}

// GET ?action=logs&week=22  -> rows for that week_iso (or all if week omitted)
function doGet(e) {
  try {
    const action = (e.parameter.action || "logs");
    if (action !== "logs") return json_({ ok: false, error: "unknown action" });

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
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
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
