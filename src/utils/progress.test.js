import { describe, it, expect, beforeEach } from "vitest";
import { setConfig } from "../data/configStore.js";
import { strengthTargetToday, cardioTargetToday, cardState } from "./progress.js";

// Minimal test config: RDL classic on Пн/Чт/Вс (2/day), ISO daily (2/day),
// Bulgarian on Пн/Вт/Чт/Пт/Вс (1/day), plus a cardio (tempo, 2/session, Ср only).
const META = { label: "", circuitType: "", circuitLabel: "" };
const day = (strength, cardio = []) => ({ ...META, strength, cardio });

function seedConfig() {
  setConfig({
    exerciseById: {
      rdl_classic: { id: "rdl_classic", type: "STR", setsPerSession: 2 },
      iso:         { id: "iso",         type: "ISO", setsPerSession: 2 },
      bulgarian:   { id: "bulgarian",   type: "STR", setsPerSession: 1 },
      tempo:       { id: "tempo",       type: "CARDIO", setsPerSession: 2 },
    },
    exercises: [],
    schedule: {
      "Пн": day(["rdl_classic", "iso", "bulgarian"]),
      "Вт": day(["iso", "bulgarian"]),
      "Ср": day(["iso"], ["tempo"]),
      "Чт": day(["rdl_classic", "iso", "bulgarian"]),
      "Пт": day(["iso", "bulgarian"]),
      "Сб": day(["iso"]),
      "Вс": day(["rdl_classic", "iso", "bulgarian"]),
    },
    habits: {}, habitsByDay: {}, polza: [], polzaById: {},
  });
}

// helper to fabricate log rows
const log = (exId, dayName, n = 1) =>
  Array.from({ length: n }, () => ({ exercise_id: exId, day: dayName }));

beforeEach(seedConfig);

describe("strengthTargetToday — base cases", () => {
  it("first scheduled day with no logs = base", () => {
    // today=Пн, viewing Пн
    expect(strengthTargetToday("rdl_classic", "Пн", [], "Пн")).toBe(2);
    expect(strengthTargetToday("bulgarian", "Пн", [], "Пн")).toBe(1);
  });

  it("returns 0 when exercise not scheduled that day", () => {
    expect(strengthTargetToday("rdl_classic", "Вт", [], "Вт")).toBe(0);
  });
});

describe("strengthTargetToday — deficit carries to NEXT scheduled day only", () => {
  it("Пн missed → Чт shows base+carry, Вс stays base (no double-count)", () => {
    // today=Чт. Пн closed with 0 done. RDL classic sched [Пн,Чт,Вс].
    const logs = []; // nothing logged
    expect(strengthTargetToday("rdl_classic", "Чт", logs, "Чт")).toBe(4); // 2 + carry2
    expect(strengthTargetToday("rdl_classic", "Вс", logs, "Чт")).toBe(2); // NOT 4
  });

  it("deficit does not land on non-scheduled days", () => {
    // RDL classic never appears on Вт/Ср/Пт/Сб regardless of carry
    expect(strengthTargetToday("rdl_classic", "Вт", [], "Чт")).toBe(0);
    expect(strengthTargetToday("rdl_classic", "Ср", [], "Чт")).toBe(0);
  });
});

describe("strengthTargetToday — future/today days are not phantom-deficit", () => {
  it("ISO daily, all past done, viewing Вс from Чт → base (not inflated)", () => {
    // today=Чт. Пн,Вт,Ср done 2 each (closed). Чт today done 2. Пт/Сб future.
    const logs = [
      ...log("iso", "Пн", 2), ...log("iso", "Вт", 2), ...log("iso", "Ср", 2),
      ...log("iso", "Чт", 2),
    ];
    // Вс target must be base 2 — Пт/Сб are future, not deficit
    expect(strengthTargetToday("iso", "Вс", logs, "Чт")).toBe(2);
  });

  it("ISO with Пн skipped (today=Чт) → Чт inflated, Вс still base", () => {
    const logs = [
      ...log("iso", "Вт", 2), ...log("iso", "Ср", 2), // Пн missing
    ];
    // walk closed days before Чт: Пн(0)→carry2, Вт(2)→carry2, Ср(2)→carry2
    expect(strengthTargetToday("iso", "Чт", logs, "Чт")).toBe(4);
    // viewing Вс: Чт open absorbs → Вс base
    expect(strengthTargetToday("iso", "Вс", logs, "Чт")).toBe(2);
  });
});

describe("strengthTargetToday — surplus reduces next scheduled day", () => {
  it("Пн overdone → Чт reduced to 0, Вс back to base", () => {
    // today=Вс so Пн and Чт are closed. RDL classic [Пн,Чт,Вс].
    const logs = [...log("rdl_classic", "Пн", 4)]; // surplus 2 on Пн, Чт done 0
    // Чт: carry from Пн = 2-4 = -2 → max(0, 2-2)=0
    expect(strengthTargetToday("rdl_classic", "Чт", logs, "Вс")).toBe(0);
    // Вс: Пн(-2 surplus) then Чт(0 done, base2) → carry = 2 + (-2) - 0 = 0 → base 2
    expect(strengthTargetToday("rdl_classic", "Вс", logs, "Вс")).toBe(2);
  });

  it("huge surplus cascades through multiple days to 0", () => {
    const logs = [...log("rdl_classic", "Пн", 10)]; // +8 surplus
    expect(strengthTargetToday("rdl_classic", "Чт", logs, "Вс")).toBe(0);
    expect(strengthTargetToday("rdl_classic", "Вс", logs, "Вс")).toBe(0);
  });
});

describe("weekly invariant: planned (today+future) never exceeds weekly total", () => {
  // Invariant applies to today + upcoming scheduled days (planned work remaining),
  // NOT to past days (those show historical/missed targets in red). With today=Пн
  // every scheduled day is today-or-future, so their targets sum to the week total.
  it("RDL classic planned-ahead sum == 6 when nothing done (today=Пн)", () => {
    const sum =
      strengthTargetToday("rdl_classic", "Пн", [], "Пн") +
      strengthTargetToday("rdl_classic", "Чт", [], "Пн") +
      strengthTargetToday("rdl_classic", "Вс", [], "Пн");
    expect(sum).toBe(6);
  });

  it("never exceeds 6 across several done-states (today=Пн)", () => {
    const scenarios = [
      [],
      [...log("rdl_classic", "Пн", 1)],
      [...log("rdl_classic", "Пн", 4)],
      [...log("rdl_classic", "Пн", 2), ...log("rdl_classic", "Чт", 2)],
    ];
    for (const logs of scenarios) {
      const sum =
        strengthTargetToday("rdl_classic", "Пн", logs, "Пн") +
        strengthTargetToday("rdl_classic", "Чт", logs, "Пн") +
        strengthTargetToday("rdl_classic", "Вс", logs, "Пн");
      expect(sum).toBeLessThanOrEqual(6);
    }
  });

  it("all crammed onto last day when week ends unworked (today=Вс)", () => {
    // Nothing done; on Вс the whole RDL volume is owed that day (catch-up cascade).
    expect(strengthTargetToday("rdl_classic", "Вс", [], "Вс")).toBe(6);
  });
});

describe("cardioTargetToday — static, no carry", () => {
  it("returns setsPerSession on scheduled day", () => {
    expect(cardioTargetToday("tempo", "Ср")).toBe(2);
  });
  it("returns 0 when not scheduled", () => {
    expect(cardioTargetToday("tempo", "Пн")).toBe(0);
  });
});

describe("cardState", () => {
  it("target 0 → complete (surplus absorbed)", () => {
    expect(cardState(0, 0)).toBe("complete");
  });
  it("done 0, target>0 → not_started", () => {
    expect(cardState(0, 2)).toBe("not_started");
  });
  it("partial → in_progress", () => {
    expect(cardState(1, 2)).toBe("in_progress");
  });
  it("done==target → complete", () => {
    expect(cardState(2, 2)).toBe("complete");
  });
  it("done>target → overlogged", () => {
    expect(cardState(3, 2)).toBe("overlogged");
  });
});
