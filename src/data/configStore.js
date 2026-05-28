// Module-level config singleton with subscribe semantics.
//
// Why a singleton instead of pure React Context?
//   `src/utils/progress.js` is a pure function called from many places (ProgressBar,
//   WeekStatsModal, ExerciseCard, MultiSetModal computations in App.jsx). Threading
//   schedule/exerciseById through every callsite as args would be invasive.
//   A module-level singleton lets pure functions read current config; the useConfig()
//   hook on top makes React components reactively re-render when config changes.

import { defaultConfig } from "../services/config.js";

let _state = defaultConfig();
const _listeners = new Set();

export function getConfig() {
  return _state;
}

export function setConfig(next) {
  _state = next;
  for (const fn of _listeners) {
    try { fn(_state); } catch { /* listener crashed, don't break others */ }
  }
}

export function subscribeConfig(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
