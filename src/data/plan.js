// Hardcoded fallback plan. Mirrors Google Sheet tab "Coach recs, 20 may 2026".
// STR/ISO log into reps/load/unit. CARDIO logs into cardioFields (distance_km/duration_min/quality_min).

export const exercises = [
  // ---- STRENGTH / ISO ----
  { id: "rdl_classic",    name: "RDL classic",     type: "STR", unit: "kg",   defaultReps: 8,  defaultLoad: 120, setsPerSession: 2, description: "Barbell Romanian Deadlift" },
  { id: "rdl_single_leg", name: "RDL single leg",  type: "STR", unit: "kg",   defaultReps: 10, defaultLoad: 80,  setsPerSession: 2, description: "1 set = each leg" },
  { id: "iso_hamstring",  name: "ISO hamstring",   type: "ISO", unit: "sec",  defaultReps: 1,  defaultLoad: 45,  setsPerSession: 2, description: "Isometric hold 45 seconds" },
  { id: "gliders",        name: "Gliders",         type: "STR", unit: "kg",   defaultReps: 6,  defaultLoad: 40,  setsPerSession: 2, description: "Askling protocol. 1 set = each leg. BW = 1/2 weight." },
  { id: "calf_raises",    name: "Calf raises",     type: "STR", unit: "kg",   defaultReps: 10, defaultLoad: 60,  setsPerSession: 2, description: "HSR. 35mm drop heel. Tempo 3-1-3." },
  { id: "gluteus_medius", name: "Gluteus medius",  type: "STR", unit: "kg",   defaultReps: 8,  defaultLoad: 15,  setsPerSession: 2, description: "Weighted side plank raises. Tempo 2-1-2." },
  { id: "copenhagen",     name: "Copenhagen plank",type: "STR", unit: "reps", defaultReps: 8,  defaultLoad: null,setsPerSession: 2, description: "Dynamic hip drops, full lever. Tempo 2-1-2. 1 set = each side." },
  { id: "bulgarian",      name: "Bulgarian squat", type: "STR", unit: "kg",   defaultReps: 12, defaultLoad: 60,  setsPerSession: 1, description: "1 set = both legs. Reduced volume." },
  { id: "bench",          name: "Bench press",     type: "STR", unit: "kg",   defaultReps: 7,  defaultLoad: 75,  setsPerSession: 2, description: "Machine. Count only added plates." },

  // ---- CARDIO ----
  // cardioFields: { key -> Log column, label, unit, default }. Modal renders one input per field.
  { id: "z2_run",   name: "Z2 run",      type: "CARDIO", setsPerSession: 1, description: "Easy pace <150 HR",
    cardioFields: [
      { key: "distance_km",  label: "Дистанция", unit: "km",  default: 11 },
      { key: "duration_min", label: "Время",     unit: "min", default: null }
    ] },
  { id: "long_z2",  name: "Long Z2 run", type: "CARDIO", setsPerSession: 1, description: "Long easy run",
    cardioFields: [
      { key: "distance_km",  label: "Дистанция", unit: "km",  default: 12 },
      { key: "duration_min", label: "Время",     unit: "min", default: null }
    ] },
  { id: "tempo",    name: "Tempo run",   type: "CARDIO", setsPerSession: 1, description: "HR 165-170. Key session. Дистанция в зачёт + темповое время.",
    cardioFields: [
      { key: "distance_km", label: "Общая дистанция", unit: "km",  default: null },
      { key: "quality_min", label: "Темповое время",  unit: "min", default: 25 } // 2×12.5/нед
    ] },
  { id: "intervals", name: "Intervals",  type: "CARDIO", setsPerSession: 1, description: "6×800m. HR 175-185. Key session. Дистанция в зачёт + время интервалов.",
    cardioFields: [
      { key: "distance_km", label: "Общая дистанция", unit: "km",  default: null },
      { key: "quality_min", label: "Время интервалов",unit: "min", default: null }
    ] },
  { id: "basketball", name: "Basketball", type: "CARDIO", setsPerSession: 1, description: "Зона 2. Трекаем время.",
    cardioFields: [
      { key: "duration_min", label: "Время", unit: "min", default: 60 }
    ] },
  { id: "z2_cycle", name: "Z2 cycle",    type: "CARDIO", setsPerSession: 1, description: "HR 135-145. Low impact. 90 мин, Пт.",
    cardioFields: [
      { key: "duration_min", label: "Время", unit: "min", default: 90 }
    ] }
];

export const exerciseById = Object.fromEntries(exercises.map(e => [e.id, e]));
