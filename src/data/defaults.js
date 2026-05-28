// Bootstrap defaults for the config layer.
// Used as initial state until sheet/cache loads, and as fallback when both fail.
// The sheet (Week Plan / Habbits / Польза) is the runtime source of truth.

import { exercises, exerciseById } from "./plan.js";
import { schedule, WEEK, KEY_DAYS } from "./schedule.js";
import { habits, habitsByDay } from "./habits.js";
import { polza, polzaById } from "./polza.js";

// Per-day metadata (label, circuitType, circuitLabel) — NOT overridden by the sheet.
// Strength/cardio arrays come from the sheet; we keep these meta fields stable.
export const scheduleMeta = Object.fromEntries(
  WEEK.map(d => {
    const { label, circuitType, circuitLabel } = schedule[d];
    return [d, { label, circuitType, circuitLabel }];
  })
);

export {
  exercises, exerciseById,
  schedule,
  WEEK, KEY_DAYS,
  habits, habitsByDay,
  polza, polzaById,
};
