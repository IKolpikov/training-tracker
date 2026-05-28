// Loads Week Plan / Habbits / Польза from the sheet and reshapes them into the
// data structures the app already uses (exerciseById, schedule, habitsByDay, polza).
//
// Cardio cardioFields (field structure → Log columns) stay hardcoded — sheet rows
// only override `setsPerSession` and which days the cardio session is scheduled on.
// For STR/ISO everything (defaults, sets, schedule) comes from the sheet.

import { fetchPlanRows, fetchHabitsRows, fetchPolzaRows } from "./sheets.js";
import * as DEFAULTS from "../data/defaults.js";

const CACHE_KEY = "config_cache_v1";

// ── Shape helpers ───────────────────────────────────────────────────────────

// Cardio fields template, keyed by exercise id. Required because the sheet can't
// express "which Log column does this number go into" cleanly. We override only
// the defaults from the sheet — never the keys or labels.
const CARDIO_FIELDS_BY_ID = Object.fromEntries(
  DEFAULTS.exercises
    .filter(e => e.type === "CARDIO")
    .map(e => [e.id, e.cardioFields])
);

const CARDIO_DEFAULTS_BY_ID = Object.fromEntries(
  DEFAULTS.exercises
    .filter(e => e.type === "CARDIO")
    .map(e => [e.id, e])
);

// Infer STR vs ISO from Unit column. ISO = isometric hold (seconds).
function inferType(sheetType, unit) {
  if (sheetType && sheetType.toLowerCase().startsWith("cardio")) return "CARDIO";
  if (unit === "seconds") return "ISO";
  return "STR";
}

// Build exerciseById + schedule from Week Plan rows.
function buildPlanConfig(planRows) {
  const exById = {};
  const schedule = {
    "Пн": { ...DEFAULTS.scheduleMeta["Пн"], strength: [], cardio: [] },
    "Вт": { ...DEFAULTS.scheduleMeta["Вт"], strength: [], cardio: [] },
    "Ср": { ...DEFAULTS.scheduleMeta["Ср"], strength: [], cardio: [] },
    "Чт": { ...DEFAULTS.scheduleMeta["Чт"], strength: [], cardio: [] },
    "Пт": { ...DEFAULTS.scheduleMeta["Пт"], strength: [], cardio: [] },
    "Сб": { ...DEFAULTS.scheduleMeta["Сб"], strength: [], cardio: [] },
    "Вс": { ...DEFAULTS.scheduleMeta["Вс"], strength: [], cardio: [] },
  };

  for (const r of planRows) {
    const id   = r.id;
    const day  = r.day;
    if (!id || !schedule[day]) continue;
    const type = inferType(r.type, r.unit);

    // Defaults: first occurrence of this id wins (subsequent rows should agree).
    if (!exById[id]) {
      if (type === "CARDIO") {
        const cardioBase = CARDIO_DEFAULTS_BY_ID[id] || {};
        const baseFields = CARDIO_FIELDS_BY_ID[id] || [];
        // Override cardioField defaults from sheet: Reps → field[0], Load → field[1].
        const fields = baseFields.map((f, i) => {
          if (i === 0 && r.reps !== null) return { ...f, default: r.reps };
          if (i === 1 && r.load !== null) return { ...f, default: r.load };
          return f;
        });
        exById[id] = {
          ...cardioBase,
          id, name: r.name || cardioBase.name || id,
          type: "CARDIO",
          setsPerSession: r.sets || 1,
          cardioFields: fields,
          description: r.notes || cardioBase.description || "",
        };
      } else {
        exById[id] = {
          id, name: r.name || id,
          type,
          unit: r.unit === "seconds" ? "sec" : (r.unit || "reps"),
          defaultReps: r.reps,
          defaultLoad: r.load,
          setsPerSession: r.sets ?? 1,
          description: r.notes || "",
        };
      }
    }

    // Schedule: append to strength or cardio bucket for this day.
    const bucket = type === "CARDIO" ? "cardio" : "strength";
    if (!schedule[day][bucket].includes(id)) schedule[day][bucket].push(id);
  }

  // Build ordered exercises array from exById preserving insertion order.
  const exercises = Object.values(exById);
  return { exerciseById: exById, exercises, schedule };
}

function buildHabitsConfig(habitsRows) {
  const habits = {};
  const habitsByDay = { "Пн":[], "Вт":[], "Ср":[], "Чт":[], "Пт":[], "Сб":[], "Вс":[] };
  for (const r of habitsRows) {
    if (!habits[r.id]) habits[r.id] = { id: r.id, name: r.name };
    if (habitsByDay[r.day] && !habitsByDay[r.day].includes(r.id)) {
      habitsByDay[r.day].push(r.id);
    }
  }
  return { habits, habitsByDay };
}

function buildPolzaConfig(polzaRows) {
  const polza = polzaRows.map(r => ({ id: r.id, name: r.name }));
  const polzaById = Object.fromEntries(polza.map(p => [p.id, p]));
  return { polza, polzaById };
}

// ── Public API ──────────────────────────────────────────────────────────────

// One round trip = 3 GETs. ~50-200ms each typically. We fire them in parallel.
export async function fetchConfig() {
  const [planRows, habitsRows, polzaRows] = await Promise.all([
    fetchPlanRows(),
    fetchHabitsRows(),
    fetchPolzaRows(),
  ]);
  return {
    ...buildPlanConfig(planRows),
    ...buildHabitsConfig(habitsRows),
    ...buildPolzaConfig(polzaRows),
  };
}

export function getCachedConfig() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)); }
  catch { return null; }
}

export function setCachedConfig(cfg) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cfg)); }
  catch { /* quota exceeded; ignore */ }
}

// Bootstrap config from hardcoded defaults. Used as initial state until cache/server arrive.
export function defaultConfig() {
  return {
    exerciseById: DEFAULTS.exerciseById,
    exercises:    DEFAULTS.exercises,
    schedule:     DEFAULTS.schedule,
    habits:       DEFAULTS.habits,
    habitsByDay:  DEFAULTS.habitsByDay,
    polza:        DEFAULTS.polza,
    polzaById:    DEFAULTS.polzaById,
  };
}
