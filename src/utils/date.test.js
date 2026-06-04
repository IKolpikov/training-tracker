import { describe, it, expect } from "vitest";
import { realTimestamp } from "./date.js";

describe("realTimestamp — strictly monotonic", () => {
  it("two calls in the same ms get distinct timestamps", () => {
    const fixed = new Date("2026-06-04T12:00:00.123Z");
    const a = realTimestamp(fixed);
    const b = realTimestamp(fixed); // same Date — collision would happen here
    expect(a).not.toBe(b);
    expect(b > a).toBe(true);
  });

  it("a thousand rapid calls are all unique", () => {
    const fixed = new Date("2026-06-04T12:00:00.000Z");
    const seen = new Set();
    for (let i = 0; i < 1000; i++) seen.add(realTimestamp(fixed));
    expect(seen.size).toBe(1000);
  });

  it("never goes backwards even with a back-edged clock", () => {
    realTimestamp(new Date("2026-06-04T12:00:00.500Z"));
    const back = realTimestamp(new Date("2026-06-04T12:00:00.100Z"));
    expect(back > "2026-06-04T12:00:00.500").toBe(true);
  });
});
