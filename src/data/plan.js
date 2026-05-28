// Hardcoded plan. Mirrors Google Sheet tabs "Week Plan May 2026" and "Total load plan May 2026".
// STR/ISO log into reps/load/unit. CARDIO logs into cardioFields (distance_km/duration_min/quality_min).
//
// Tonnage (load × reps × sets per week) is implicit in Log rows via reps/load columns;
// we'll surface it as charts later (per-exercise + total per week).

export const exercises = [
  // ---- STRENGTH / ISO ----
  { id: "rdl_classic",    name: "RDL classic",     type: "STR", unit: "kg",   defaultReps: 8,  defaultLoad: 120, setsPerSession: 2, description: "Barbell Romanian Deadlift" },
  { id: "rdl_single_leg", name: "RDL single leg",  type: "STR", unit: "kg",   defaultReps: 12, defaultLoad: 80,  setsPerSession: 2, description: "1 set = each leg" },
  { id: "iso_hamstring",  name: "ISO hamstring",   type: "ISO", unit: "sec",  defaultReps: 45, defaultLoad: 40,  setsPerSession: 2, description: "Isometric 45 sec hold, ½ bodyweight (≈40kg)" },
  { id: "gliders",        name: "Gliders",         type: "STR", unit: "kg",   defaultReps: 12, defaultLoad: 40,  setsPerSession: 2, description: "Askling protocol. 1 set = each leg. Weight = ½ bodyweight." },
  { id: "calf_raises",    name: "Calf raises",     type: "STR", unit: "kg",   defaultReps: 8,  defaultLoad: 70,  setsPerSession: 2, description: "HSR. 35mm drop heel. Tempo 3-1-3." },
  { id: "gluteus_medius", name: "Gluteus medius",  type: "STR", unit: "kg",   defaultReps: 8,  defaultLoad: 15,  setsPerSession: 2, description: "Weighted side plank raises. Tempo 2-1-2." },
  { id: "copenhagen",     name: "Copenhagen plank",type: "STR", unit: "reps", defaultReps: 11, defaultLoad: 40,  setsPerSession: 2, description: "Dynamic hip drops. Tempo 2-1-2. 1 set = each side. Weight = ½ bodyweight." },
  { id: "bulgarian",      name: "Bulgarian squat", type: "STR", unit: "kg",   defaultReps: 12, defaultLoad: 60,  setsPerSession: 1, description: "1 set = both legs. Reduced volume." },
  { id: "bench",          name: "Bench press",     type: "STR", unit: "kg",   defaultReps: 7,  defaultLoad: 75,  setsPerSession: 2, description: "Streetworkout standing machine. Plates only." },

  // ---- CARDIO ----
  // cardioFields: { key -> Log column, label, unit, default }. Modal renders one input per field.
  { id: "z2_run",   name: "Z2 run",      type: "CARDIO", setsPerSession: 1, description: "135–150 HR easy run",
    cardioFields: [
      { key: "distance_km",  label: "Дистанция", unit: "km",  default: 11 },
      { key: "duration_min", label: "Время",     unit: "min", default: 60 }
    ] },
  { id: "long_z2",  name: "Long Z2 run", type: "CARDIO", setsPerSession: 1, description: "Long easy run",
    cardioFields: [
      { key: "distance_km",  label: "Дистанция", unit: "km",  default: 12 },
      { key: "duration_min", label: "Время",     unit: "min", default: 70 }
    ] },
  { id: "tempo",    name: "Tempo run",   type: "CARDIO", setsPerSession: 2, description: "WU + 12.5 min + 3 min jog + 12.5 min + CD. Each tempo interval = 1 set.",
    cardioFields: [
      { key: "distance_km", label: "Общая дистанция", unit: "km",  default: 9.5 },
      { key: "quality_min", label: "Темповое время",  unit: "min", default: 12.5 }
    ] },
  { id: "intervals", name: "Intervals",  type: "CARDIO", setsPerSession: 6, description: "6×[800m + 1min rest]. HR 175+. Each 800m repeat = 1 set.",
    cardioFields: [
      { key: "distance_km", label: "Дистанция повтора", unit: "km",      default: 0.8 },
      { key: "quality_min", label: "Время повтора",      unit: "мин.сек", default: null } // формат m.ss, напр. 8.12 = 8 мин 12 сек
    ] },
  { id: "basketball", name: "Basketball", type: "CARDIO", setsPerSession: 1, description: "Solo shooting + dribbling. Easy cardio.",
    cardioFields: [
      { key: "duration_min", label: "Время", unit: "min", default: 60 }
    ] },
  { id: "z2_cycle", name: "Z2 cycle",    type: "CARDIO", setsPerSession: 1, description: "135–145 HR. Low impact.",
    cardioFields: [
      { key: "duration_min", label: "Время", unit: "min", default: 93 }
    ] }
];

export const exerciseById = Object.fromEntries(exercises.map(e => [e.id, e]));
