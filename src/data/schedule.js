// Hardcoded fallback schedule. Mirrors Google Sheet tab "Week example".
// KEY days (Ср, Сб) carry tempo/intervals — strength catch-up never lands here.

export const KEY_DAYS = ["Ср", "Сб"];
export const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const schedule = {
  "Пн": { label: "Monday",    circuitType: "A",   circuitLabel: "Full circuit",
          strength: ["rdl_classic","iso_hamstring","gliders","calf_raises","gluteus_medius","copenhagen","bulgarian","bench"],
          cardio: ["z2_run"] },
  "Вт": { label: "Tuesday",   circuitType: "B",   circuitLabel: "Circuit B",
          strength: ["rdl_single_leg","iso_hamstring","gliders","calf_raises","gluteus_medius","copenhagen","bulgarian","bench"],
          cardio: ["basketball"] },
  "Ср": { label: "Wednesday", circuitType: "KEY", circuitLabel: "Key session",
          strength: ["iso_hamstring","bench"],
          cardio: ["tempo"] },
  "Чт": { label: "Thursday",  circuitType: "A",   circuitLabel: "Full circuit",
          strength: ["rdl_classic","iso_hamstring","gliders","calf_raises","gluteus_medius","copenhagen","bulgarian","bench"],
          cardio: ["basketball"] },
  "Пт": { label: "Friday",    circuitType: "C",   circuitLabel: "Circuit C (light, pre-intervals)",
          strength: ["rdl_single_leg","gliders","calf_raises","gluteus_medius","copenhagen","bulgarian"],
          cardio: ["z2_cycle"] },
  "Сб": { label: "Saturday",  circuitType: "KEY", circuitLabel: "Key session",
          strength: ["iso_hamstring"],
          cardio: ["intervals"] },
  "Вс": { label: "Sunday",    circuitType: "A",   circuitLabel: "Full circuit",
          strength: ["rdl_classic","iso_hamstring","gliders","calf_raises","gluteus_medius","copenhagen","bulgarian","bench"],
          cardio: ["basketball","long_z2"] }
};
