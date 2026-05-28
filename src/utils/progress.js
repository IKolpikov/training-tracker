// Progress + strength deficit/surplus carry.
//
// Rule (locked with user, see Total Load plan sheet):
//   - Дефицит: undone sets cascade onto the NEAREST NEXT scheduled day of that exercise.
//   - Профицит: extra sets reduce the NEAREST NEXT scheduled day to 0 (shown green "0/0").
//     Leftover surplus keeps cascading forward through subsequent scheduled days.
//   - Invariant: SUM of planned sets across the week == Total Load (sheet), unless
//     surplus exceeds remaining volume, in which case SUM < Total Load (over-achievement).
//   - Cardio is NOT redistributed (per-session static target).
//   - KEY days no longer special-cased for math (the new rule treats every scheduled day equally).
//     KEY_DAYS still drives the visual "Key session" badge, that's all.
//
// Implementation: walk all prior scheduled days chronologically; maintain a signed `carry`
// that represents net deficit (positive) or surplus (negative) entering today.
//   carry_out = base + carry_in - done   (unclamped — so surplus excess is preserved)
//   target_today = max(0, base + carry)

import { WEEK } from "../data/schedule.js";          // WEEK is a static constant
import { getConfig } from "../data/configStore.js"; // dynamic — pulls latest config each call
import { getRussianDay, logicalNow } from "./date.js";

function scheduledDays(exId) {
  const { schedule } = getConfig();
  return WEEK.filter(d => schedule[d].strength.includes(exId));
}

// weekLogs: Log rows for the CURRENT week_iso (already filtered).
// Walks scheduled days chronologically up to the viewed day, accumulating signed `carry`:
//
//   carry_out = base + carry_in - done_at_that_day
//
// Two regimes for "done_at_that_day", split at the 04:00 logical-day boundary:
//
//   CLOSED past day (priorIdx < actualTodayIdx):
//     done = actual logged count for that day. Deficit/surplus is REAL.
//
//   Today or future day (priorIdx >= actualTodayIdx):
//     done = expected = max(0, base + carry_in)  (the displayed target on that day).
//     Per user's stated rule, the carry only "переезжает" after 04:00 next day.
//     So an in-progress or unviewed-future day is ASSUMED to hit its displayed target.
//     This makes carry_out for such days = min(0, base + carry_in) — deficit is fully
//     consumed by that day's displayed target (carry_out = 0), surplus passes through
//     intact (negative). Crucial: prevents double-counting a missed past day on every
//     subsequent scheduled day. Sum(displayed targets) stays ≤ Total Load invariant.
//
// Today's own logs do NOT change today's target (it shows base + accumulated carry).
// Logging on a CLOSED past day retroactively recomputes downstream targets.
export function strengthTargetToday(exId, day, weekLogs, todayDayName = getRussianDay(logicalNow())) {
  const { exerciseById, schedule } = getConfig();
  const ex = exerciseById[exId];
  if (!ex) return 0;
  const onCardToday = schedule[day].strength.includes(exId);
  if (!onCardToday) return 0;
  const base = ex.setsPerSession;

  const sched = scheduledDays(exId);
  const todayPos = sched.indexOf(day);
  if (todayPos <= 0) return base;  // first scheduled day → no prior carry, target = base

  const actualTodayIdx = WEEK.indexOf(todayDayName);

  let carry = 0;
  for (let i = 0; i < todayPos; i++) {
    const priorDay = sched[i];
    const priorIdx = WEEK.indexOf(priorDay);
    if (priorIdx < actualTodayIdx) {
      // Closed past day: use actual.
      const priorDone = weekLogs.filter(
        r => r.exercise_id === exId && r.day === priorDay
      ).length;
      carry = base + carry - priorDone;
    } else {
      // Today or future, still open: assume hits displayed target.
      // Deficit lands on it (carry → 0); surplus passes through (stays negative).
      carry = Math.min(0, base + carry);
    }
  }

  return Math.max(0, base + carry);
}

// Cardio target is static: setsPerSession, no redistribution.
export function cardioTargetToday(exId, day) {
  const { exerciseById, schedule } = getConfig();
  if (!schedule[day].cardio.includes(exId)) return 0;
  const ex = exerciseById[exId];
  return ex ? ex.setsPerSession : 0;
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
  const { schedule } = getConfig();
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
