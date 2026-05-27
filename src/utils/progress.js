// Progress + strength catch-up redistribution.
// Rules locked with user:
//  - Catch-up applies to STR/ISO only. Cardio deficit is NOT redistributed.
//  - Deficit lands only on non-KEY days (anywhere except Ср, Сб).
//  - Bonus never adds a NEW card to a day: if exercise isn't scheduled today, target stays 0.
//  - Week resets weekly (current week_iso only). Unfinished volume burns on Вс.

import { WEEK, KEY_DAYS, schedule } from "../data/schedule.js";
import { exerciseById } from "../data/plan.js";

function scheduledDays(exId) {
  return WEEK.filter(d => schedule[d].strength.includes(exId));
}

// weekLogs: array of Log rows for the CURRENT week_iso (already filtered).
// Returns today's target set count for a strength exercise, with catch-up baked in.
export function strengthTargetToday(exId, day, weekLogs) {
  const ex = exerciseById[exId];
  const onCardToday = schedule[day].strength.includes(exId);
  const base = onCardToday ? ex.setsPerSession : 0;
  if (base === 0) return 0;                 // not on today's card -> no bonus injected
  if (KEY_DAYS.includes(day)) return base;  // KEY day -> never receives catch-up

  const sched = scheduledDays(exId);
  const todayIdx = WEEK.indexOf(day);

  // Sets that SHOULD be done by end of today.
  const expected = sched.filter(d => WEEK.indexOf(d) <= todayIdx).length * ex.setsPerSession;
  const done = weekLogs.filter(r => r.exercise_id === exId).length;

  // deficit > 0 = catch-up needed; deficit < 0 = surplus, reduce future targets.
  const deficit = expected - done;

  // Remaining non-KEY scheduled days (today included) to spread adjustment over.
  const remaining = sched.filter(d => !KEY_DAYS.includes(d) && WEEK.indexOf(d) >= todayIdx).length;
  const adjustment = remaining > 0 ? Math.ceil(deficit / remaining) : 0;

  return Math.max(0, base + adjustment);
}

// Cardio target is static: setsPerSession, no redistribution.
export function cardioTargetToday(exId, day) {
  return schedule[day].cardio.includes(exId) ? exerciseById[exId].setsPerSession : 0;
}

// Sets logged for an exercise on a specific logical date.
export function doneToday(exId, dateStr, dayLogs) {
  return dayLogs.filter(r => r.exercise_id === exId && r.date === dateStr).length;
}

// Card state for UI. "complete" gates on done >= target (target is floating now).
// target can be 0 when surplus absorbed all remaining sets for today.
export function cardState(done, target) {
  if (target === 0) return "complete";     // surplus absorbed; nothing needed today
  if (done === 0) return "not_started";
  if (done < target) return "in_progress";
  if (done === target) return "complete";
  return "overlogged";
}

// Day progress %: completed (capped per exercise) / total target sets for the day.
export function dayProgress(day, dateStr, weekLogs, dayLogs) {
  let totalTarget = 0, completed = 0;
  for (const exId of schedule[day].strength) {
    const t = strengthTargetToday(exId, day, weekLogs);
    totalTarget += t;
    completed += Math.min(doneToday(exId, dateStr, dayLogs), t);
  }
  for (const exId of schedule[day].cardio) {
    const t = cardioTargetToday(exId, day);
    totalTarget += t;
    completed += Math.min(doneToday(exId, dateStr, dayLogs), t);
  }
  const pct = totalTarget > 0 ? Math.round((completed / totalTarget) * 100) : 0;
  return { completed, totalTarget, pct };
}
