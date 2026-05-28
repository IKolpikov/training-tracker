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
    if (header === "timestamp") return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
    return Utilities.formatDate(value, "UTC", "yyyy-MM-dd'T'HH:mm:ss");
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
  const vals = sh.getDataRange().getValues();
  if (!vals.length) return json_({ ok: true, rows: [] });

  const HEADER_WORDS = ["id", "name", "польза", "задача", "дело", "рутина", "день"];
  const firstRow = vals[0].map(c => s_(c).toLowerCase());
  const hasHeader = firstRow.some(c => HEADER_WORDS.indexOf(c) !== -1);

  let idCol = -1, nameCol = 0, startRow = 0;
  if (hasHeader) {
    startRow = 1;
    idCol = firstRow.indexOf("id");
    // name column = first non-id non-empty header cell
    for (let i = 0; i < firstRow.length; i++) {
      if (i !== idCol && firstRow[i]) { nameCol = i; break; }
    }
  }

  const out = [];
  for (let r = startRow; r < vals.length; r++) {
    const name = s_(vals[r][nameCol]);
    if (!name) continue;
    const explicitId = (idCol !== -1) ? vals[r][idCol] : "";
    out.push({ id: resolveId_(explicitId, name, CANONICAL_POLZA_IDS), name });
  }
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
