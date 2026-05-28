import { describe, it, expect } from "vitest";
import { buildPlanConfig, buildHabitsConfig, buildPolzaConfig } from "./config.js";

describe("buildPlanConfig", () => {
  const rows = [
    { id: "rdl_classic", day: "Пн", type: "STR routine", name: "RDL classic", sets: 2, reps: 8, unit: "reps", load: 120 },
    { id: "rdl_classic", day: "Чт", type: "STR routine", name: "RDL classic", sets: 2, reps: 8, unit: "reps", load: 120 },
    { id: "iso",         day: "Пн", type: "STR routine", name: "ISO", sets: 2, reps: 45, unit: "seconds", load: 40 },
    { id: "tempo",       day: "Ср", type: "Cardio",      name: "Tempo run", sets: 2, reps: 12.5, unit: "minutes", load: 9.5 },
  ];
  const { exerciseById, schedule } = buildPlanConfig(rows);

  it("dedupes exercise defaults from first occurrence", () => {
    expect(exerciseById.rdl_classic.setsPerSession).toBe(2);
    expect(exerciseById.rdl_classic.defaultLoad).toBe(120);
  });

  it("infers ISO type from Unit=seconds", () => {
    expect(exerciseById.iso.type).toBe("ISO");
    expect(exerciseById.iso.unit).toBe("sec");
  });

  it("infers CARDIO from Type=Cardio and keeps setsPerSession", () => {
    expect(exerciseById.tempo.type).toBe("CARDIO");
    expect(exerciseById.tempo.setsPerSession).toBe(2);
  });

  it("places exercises into the right day buckets", () => {
    expect(schedule["Пн"].strength).toContain("rdl_classic");
    expect(schedule["Пн"].strength).toContain("iso");
    expect(schedule["Чт"].strength).toContain("rdl_classic");
    expect(schedule["Ср"].cardio).toContain("tempo");
  });

  it("does not duplicate an id within a day's bucket", () => {
    const dup = [
      { id: "iso", day: "Пн", type: "STR routine", name: "ISO", sets: 2, unit: "seconds" },
      { id: "iso", day: "Пн", type: "STR routine", name: "ISO", sets: 2, unit: "seconds" },
    ];
    const { schedule: s } = buildPlanConfig(dup);
    expect(s["Пн"].strength.filter(x => x === "iso").length).toBe(1);
  });
});

describe("buildHabitsConfig", () => {
  const rows = [
    { id: "likoid", day: "Пн", name: "Ликоид" },
    { id: "likoid", day: "Вт", name: "Ликоид" },
    { id: "lak",    day: "Пн", name: "Лак" },
  ];
  const { habits, habitsByDay } = buildHabitsConfig(rows);

  it("collects unique habits", () => {
    expect(habits.likoid.name).toBe("Ликоид");
    expect(Object.keys(habits).length).toBe(2);
  });
  it("maps habits per day", () => {
    expect(habitsByDay["Пн"]).toEqual(["likoid", "lak"]);
    expect(habitsByDay["Вт"]).toEqual(["likoid"]);
  });
});

describe("buildPolzaConfig", () => {
  it("builds list + byId", () => {
    const { polza, polzaById } = buildPolzaConfig([
      { id: "balkon", name: "Убраться на балконе" },
      { id: "tarakany", name: "Ловушки" },
    ]);
    expect(polza.length).toBe(2);
    expect(polzaById.balkon.name).toBe("Убраться на балконе");
  });
});
