/**
 * Training Tracker backend — Google Apps Script Web App.
 *
 * Deploy: Apps Script editor → Deploy → New deployment (or Manage deployments → Edit
 *   → New version). Web app, Execute as = Me, Who has access = Anyone. URL stays stable
 *   between deployments when you "Edit" rather than create a new one.
 *
 * CORS note: browser fetch must send Content-Type text/plain to skip preflight
 * (Apps Script web apps don't answer OPTIONS). Body is still JSON, parsed server-side.
 *
 * Sheet IDs: keep both pointing at the same file unless you split logs and plan.
 *   SHEET_ID         — Log tab (read history + append new entries).
 *   CONFIG_SHEET_ID  — Plan/Habits/Польза tabs (read-only).
 *
 * ID derivation (no `id` column required in the sheet):
 *   - If row has an `id` cell with content → use it (stable across renames).
 *   - Else look up the name in CANONICAL_*_IDS for a fixed mapping.
 *   - Else slugify the Russian name → latin (e.g. "Скрип кровати" → "skrip_krovati").
 *   Adding an `id` column lets you rename items without breaking Log history.
 */

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

// Columns that must be stored as PLAIN TEXT so values round-trip byte-for-byte
// (no Sheets Date coercion / no tz shift / no trailing-zero collapse). 1-indexed.
//   1 timestamp · 2 date · 12 distance_km · 13 duration_min · 14 quality_min
const TEXT_FORMAT_COLS = [1, 2, 12, 13, 14];
const TS_COL = HEADERS.indexOf("timestamp"); // 0

// ── Canonical name → id maps ────────────────────────────────────────────────
// Match the ids the app's hardcoded defaults use, so existing Log history
// (writted with these ids) stays linked when the sheet becomes source of truth.

const CANONICAL_PLAN_IDS = {
  "RDL classic":              "rdl_classic",
  "RDL single leg":           "rdl_single_leg",
  "ISO hamstring":            "iso_hamstring",
  "Gliders":                  "gliders",
  "Calf raises":              "calf_raises",
  "Gluteus medius with load": "gluteus_medius",
  "Gluteus medius":           "gluteus_medius",
  "Copenhagen dynamic":       "copenhagen",
  "Copenhagen plank":         "copenhagen",
  "Bulgarian squat":          "bulgarian",
  "Bench press":              "bench",
  "Z2 run":                   "z2_run",
  "Basketball":               "basketball",
  "Tempo run":                "tempo",
  "Z2 long cycling":          "z2_cycle",
  "Z2 cycle":                 "z2_cycle",
  "Intervals":                "intervals",
  "Z2 long run":              "long_z2",
  "Long Z2 run":              "long_z2",
};

const CANONICAL_HABIT_IDS = {
  "Кетанозол":  "ketanozol",
  "Ретинол":    "retinol",
  "Лак":        "lak",
  "Ликоид":     "likoid",
  "Мазь палец": "maz_palec",
  "Пилинг":     "piling",
};

const CANONICAL_POLZA_IDS = {
  "Убраться на балконе":           "balkon",
  "Обновить ловушки от тараканов": "tarakany",
  "Скрип кровати":                 "krovat_skrip",
};

// Russian → Latin transliteration for slug fallback.
const TRANSLIT_MAP = {
  "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
  "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
  "с":"s","т":"t","у":"u","ф":"f","х":"kh","ц":"ts","ч":"ch","ш":"sh","щ":"shch",
  "ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"
};

function slugify_(name) {
  const lower = String(name || "").toLowerCase();
  let out = "";
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    out += (TRANSLIT_MAP[ch] !== undefined) ? TRANSLIT_MAP[ch] : ch;
  }
  return out
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "unnamed";
}

// Returns the id for a row: explicit id col > canonical map > slug fallback.
function resolveId_(explicitId, name, canonicalMap) {
  const eid = s_(explicitId);
  if (eid) return eid;
  const mapped = canonicalMap[s_(name)];
  if (mapped) return mapped;
  return slugify_(name);
}

// ── Sheet access helpers ────────────────────────────────────────────────────

function getLogSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(LOG_TAB);
  if (!sh) {
    sh = ss.insertSheet(LOG_TAB);
    sh.appendRow(HEADERS);
    return sh;
  }
  // Self-heal: ensure a proper header row exists. A manually-created empty tab,
  // or one whose first row isn't the headers, would make getLogs_ misread data
  // (it treats row 1 as the header). Insert headers at the top when missing.
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
  } else {
    const firstCell = String(sh.getRange(1, 1).getValue()).trim();
    if (firstCell !== "timestamp") {
      sh.insertRowBefore(1);
      sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }
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

// Normalize a Log-tab cell. Sheets auto-parses dates → Date objects; we re-stringify.
function normalizeCell_(header, value) {
  if (value === "" || value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (header === "date") return Utilities.formatDate(value, "UTC", "yyyy-MM-dd");
    if (header === "timestamp") return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS");
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS");
  }
  if (header === "week_iso" && value !== "") {
    const n = Number(value);
    return isNaN(n) ? value : n;
  }
  return value;
}

// Generic header-keyed reader: trims headers, returns array of row objects.
// Cells looked up by header NAME so user can reorder columns freely.
function readTabRows_(tabName) {
  const sh = getConfigSheet_(tabName);
  const values = sh.getDataRange().getValues();
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values.shift().map(h => String(h || "").trim());
  const rows = values.map(row => {
    const o = {};
    headers.forEach((h, i) => { o[h] = row[i]; });
    return o;
  }).filter(o => Object.values(o).some(v => v !== "" && v !== null && v !== undefined));

  return { headers, rows };
}

function s_(v) { return String(v == null ? "" : v).trim(); }
function n_(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// Pre-set TEXT_FORMAT_COLS to plain text on a (yet-to-be-written) row.
function forceTextFormat_(sh, rowIdx) {
  TEXT_FORMAT_COLS.forEach(c => sh.getRange(rowIdx, c).setNumberFormat("@"));
}

// Render any timestamp cell value to the canonical "yyyy-MM-dd'T'HH:mm:ss.SSS"
// string so comparisons work whether Sheets stored it as text or as a Date.
function tsCellToString_(cell) {
  return (cell instanceof Date)
    ? Utilities.formatDate(cell, "UTC", "yyyy-MM-dd'T'HH:mm:ss.SSS")
    : String(cell).trim();
}

// Return 1-indexed row numbers in the Log sheet whose timestamp column matches.
function findLogRowsByTimestamp_(sh, timestamp) {
  const target = String(timestamp || "").trim();
  if (!target) return [];
  const values = sh.getDataRange().getValues();
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    if (tsCellToString_(values[r][TS_COL]) === target) rows.push(r + 1);
  }
  return rows;
}

// Inspect a Польза-tab sheet, returning header layout so both getPolza_ and
// addPolzaItem_ agree on where to read/write id+name.
function detectPolzaLayout_(sh) {
  const vals = sh.getDataRange().getValues();
  const HEADER_WORDS = ["id", "name", "польза", "задача", "дело", "рутина", "день"];
  const firstRow = (vals[0] || []).map(c => s_(c).toLowerCase());
  const hasHeader = firstRow.some(c => HEADER_WORDS.indexOf(c) !== -1);
  if (!hasHeader) return { vals: vals, hasHeader: false, idCol: -1, nameCol: 0 };
  const idCol = firstRow.indexOf("id");
  let nameCol = -1;
  for (let i = 0; i < firstRow.length; i++) {
    if (i !== idCol && firstRow[i]) { nameCol = i; break; }
  }
  if (nameCol < 0) nameCol = idCol === 0 ? 1 : 0;
  return { vals: vals, hasHeader: true, idCol: idCol, nameCol: nameCol, width: firstRow.length };
}

// Find a "name-like" column when headers vary. Tries common names, then any non-meta column.
function findFirstHeader_(headers, candidates, exclude) {
  for (const c of candidates) {
    const i = headers.indexOf(c);
    if (i !== -1) return headers[i];
  }
  // Fallback: first header not in exclude set.
  const exSet = new Set((exclude || []).map(s => s.toLowerCase()));
  for (const h of headers) {
    if (h && !exSet.has(h.toLowerCase())) return h;
  }
  return null;
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

// Week Plan: expected headers Day | Type | Name | Sets | Reps | Unit | Load | Load unit | Notes
//   `id` column optional. ISO type inferred from Unit="seconds".
function getPlan_() {
  const { rows } = readTabRows_(PLAN_TAB);
  const out = rows.map(r => {
    const name = s_(r["Name"]);
    return {
      id:        resolveId_(r["id"], name, CANONICAL_PLAN_IDS),
      day:       s_(r["Day"]),
      type:      s_(r["Type"]),
      name:      name,
      sets:      n_(r["Sets"]),
      reps:      n_(r["Reps"]),
      unit:      s_(r["Unit"]),
      load:      n_(r["Load"]),
      load_unit: s_(r["Load unit"]),
      notes:     s_(r["Notes"]),
    };
  }).filter(r => r.day && r.name);
  return json_({ ok: true, rows: out });
}

// Habbits: expected headers День | Рутина  (id optional)
function getHabits_() {
  const { rows } = readTabRows_(HABITS_TAB);
  const out = rows.map(r => {
    const name = s_(r["Рутина"]);
    return {
      id:   resolveId_(r["id"], name, CANONICAL_HABIT_IDS),
      day:  s_(r["День"]),
      name: name,
    };
  }).filter(r => r.day && r.name);
  return json_({ ok: true, rows: out });
}

// Польза: tolerant of a missing header row. The tab is often just a bare list
// of task names in column A (no header), so we must NOT blindly treat row 1 as
// a header — that would drop the first task. We only skip row 1 if it clearly
// looks like a header (contains a known header keyword).
function getPolza_() {
  const sh = getConfigSheet_(POLZA_TAB);
  const layout = detectPolzaLayout_(sh);
  if (!layout.vals.length) return json_({ ok: true, rows: [] });
  const startRow = layout.hasHeader ? 1 : 0;
  const out = [];
  for (let r = startRow; r < layout.vals.length; r++) {
    const name = s_(layout.vals[r][layout.nameCol]);
    if (!name) continue;
    const explicitId = layout.idCol >= 0 ? layout.vals[r][layout.idCol] : "";
    out.push({ id: resolveId_(explicitId, name, CANONICAL_POLZA_IDS), name });
  }
  return json_({ ok: true, rows: out });
}

// POST body actions:
//   - { action: "delete", timestamp }                       → remove matching Log rows
//   - { action: "update", timestamp, fields:{header: val} } → patch matching row(s) in place
//   - { action: "addPolza", name }                          → append a new task to Польза tab
//   - otherwise a single Log entry (object keyed by HEADERS) → append one row to Log
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body && body.action === "delete")   return deleteLogRows_(body.timestamp);
    if (body && body.action === "update")   return updateLogRow_(body.timestamp, body.fields);
    if (body && body.action === "addPolza") return addPolzaItem_(body.name);

    const sh  = getLogSheet_();
    const row = HEADERS.map(h => (body[h] !== undefined && body[h] !== null) ? body[h] : "");
    const r   = sh.getLastRow() + 1;
    forceTextFormat_(sh, r);
    sh.getRange(r, 1, 1, row.length).setValues([row]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Delete every Log row whose timestamp (column A) matches. Timestamps are unique
// per set (ms precision), so this removes exactly the intended entry.
function deleteLogRows_(timestamp) {
  if (!s_(timestamp)) return json_({ ok: false, error: "delete: missing timestamp" });
  const sh = getLogSheet_();
  // Delete bottom-up so 1-indexed row numbers stay valid.
  const rows = findLogRowsByTimestamp_(sh, timestamp).sort((a, b) => b - a);
  rows.forEach(r => sh.deleteRow(r));
  return json_({ ok: true, deleted: rows.length });
}

// Update the row(s) whose timestamp (col A) matches: patch only the columns named
// in `fields` (header → value). Preserves the timestamp / row identity → no race
// with delete+append, no risk of losing a row when network flakes.
function updateLogRow_(timestamp, fields) {
  if (!s_(timestamp)) return json_({ ok: false, error: "update: missing timestamp" });
  fields = fields || {};
  const sh = getLogSheet_();
  const rows = findLogRowsByTimestamp_(sh, timestamp);
  rows.forEach(r => {
    forceTextFormat_(sh, r); // keeps text-preserved cols consistent post-patch
    Object.keys(fields).forEach(h => {
      const c = HEADERS.indexOf(h);
      if (c >= 0) sh.getRange(r, c + 1).setValue(fields[h]);
    });
  });
  return json_({ ok: true, updated: rows.length });
}

// Append a new task to the Польза tab. id derives from name (canonical map → slug).
function addPolzaItem_(name) {
  const trimmed = s_(name);
  if (!trimmed) return json_({ ok: false, error: "addPolza: empty name" });
  const id = resolveId_("", trimmed, CANONICAL_POLZA_IDS);

  const sh = getConfigSheet_(POLZA_TAB);
  const layout = detectPolzaLayout_(sh);
  if (layout.hasHeader) {
    const row = new Array(layout.width).fill("");
    if (layout.idCol >= 0) row[layout.idCol] = id;
    row[layout.nameCol] = trimmed;
    sh.appendRow(row);
  } else {
    sh.appendRow([trimmed]); // bare list in column A
  }
  return json_({ ok: true, id: id, name: trimmed });
}
