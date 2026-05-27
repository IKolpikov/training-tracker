// Daily habits (skincare etc) — analogue of schedule.js for the Habits tab.
// Mirrors what the user maintains in the Google Sheet's `habits` tab.
//
// Log convention: habit entries reuse the existing Log tab with exercise_id
// prefixed `habit_<id>` so sport progress queries (which filter by specific
// exId) are not affected. Use isHabitLog() to filter habit rows out of
// aggregate counters (e.g. ProgressBar weekly total).

export const habits = {
  ketanozol: { id: "ketanozol", name: "Кетанозол" },
  retinol:   { id: "retinol",   name: "Ретинол" },
  lak:       { id: "lak",       name: "Лак" },
  likoid:    { id: "likoid",    name: "Ликоид" },
  maz_palec: { id: "maz_palec", name: "Мазь палец" },
  piling:    { id: "piling",    name: "Пилинг" },
};

export const habitsByDay = {
  "Пн": ["ketanozol", "retinol", "lak", "likoid", "maz_palec"],
  "Вт": ["likoid", "maz_palec"],
  "Ср": ["piling", "likoid", "maz_palec"],
  "Чт": ["likoid", "maz_palec"],
  "Пт": ["ketanozol", "retinol", "lak", "likoid", "maz_palec"],
  "Сб": ["likoid", "maz_palec"],
  "Вс": ["piling", "likoid", "maz_palec"],
};

export const HABIT_PREFIX = "habit_";
export const habitLogId  = (id) => HABIT_PREFIX + id;
export const isHabitLog  = (exerciseId) => String(exerciseId || "").startsWith(HABIT_PREFIX);
export const habitIdFromLog = (exerciseId) => String(exerciseId || "").slice(HABIT_PREFIX.length);
