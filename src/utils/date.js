// Single source of truth for "today". Day boundary is 04:00 local, not midnight.
// Card for Пн stays open until Вт 03:59. Week counter rolls over at Пн 04:00.

import { WEEK } from "../data/schedule.js";

export const DAY_ROLLOVER_HOURS = 4;

// Shift real time back 4h. Everything date/day/week is computed from this.
export function logicalNow(now = new Date()) {
  return new Date(now.getTime() - DAY_ROLLOVER_HOURS * 3600_000);
}

const RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]; // JS getDay(): 0=Sun

export function getRussianDay(d = logicalNow()) {
  return RU[d.getDay()];
}

export function dateStr(d = logicalNow()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ISO week number (Mon-start), computed from the logical date.
export function getWeekNumber(date = logicalNow()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// For Log column A: REAL timestamp, millisecond precision so each set row is unique
// (used as the delete/dedup key). "YYYY-MM-DDTHH:mm:ss.SSS".
export function realTimestamp(now = new Date()) {
  return now.toISOString().slice(0, 23);
}

// Human header label, e.g. "Пн, 25 мая"
const MONTHS = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
export function headerLabel(d = logicalNow()) {
  return `${getRussianDay(d)}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Date nav must not allow logging in the future (relative to logical today).
export function isFutureDate(viewed, today = logicalNow()) {
  return dateStr(viewed) > dateStr(today);
}

export { WEEK };
