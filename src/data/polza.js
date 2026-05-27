// Польза — backlog of one-off useful tasks. Done once → hidden from active list.
// "Doneness" is durable (across weeks): we keep a localStorage set of done ids
// so an item logged in week 22 stays archived when viewing week 23.
//
// Undo: tapping done shows a 5-second snackbar in the UI. Undo removes both
// the Log entry (queue + cache via removeOptimistic) and the done-id from
// localStorage. After 5s the snackbar dismisses and the archive becomes
// effectively permanent (can be edited manually in localStorage / Sheet).

export const polza = [
  { id: "smazat_krovat",   name: "Смазать кровать" },
  { id: "polit_cvety",     name: "Полить цветы" },
  { id: "postirat_kovyor", name: "Постирать ковёр" },
  { id: "zakaz_noski",     name: "Заказать новые носки" },
  { id: "pribrat_stol",    name: "Прибрать рабочий стол" },
];

export const polzaById = Object.fromEntries(polza.map(p => [p.id, p]));

export const POLZA_PREFIX = "polza_";
export const polzaLogId   = (id) => POLZA_PREFIX + id;
export const isPolzaLog   = (exerciseId) => String(exerciseId || "").startsWith(POLZA_PREFIX);
export const polzaIdFromLog = (exerciseId) => String(exerciseId || "").slice(POLZA_PREFIX.length);

const DONE_KEY = "polza_done";

export function getPolzaDoneIds() {
  try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY)) || []); }
  catch { return new Set(); }
}

export function persistPolzaDoneIds(idSet) {
  localStorage.setItem(DONE_KEY, JSON.stringify([...idSet]));
}
