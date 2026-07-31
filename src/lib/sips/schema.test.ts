import { describe, it, expect } from "vitest";
import { nextSipDate } from "./schema";

// Helper: read a date back the way the UI does, in UTC.
const dayOf = (d: Date) => d.getUTCDate();
const monthOf = (d: Date) => d.getUTCMonth();

describe("nextSipDate", () => {
  it("returns this month when the day is still ahead", () => {
    const from = new Date(Date.UTC(2026, 6, 10)); // 10 Jul 2026
    const d = nextSipDate(25, from);
    expect(dayOf(d)).toBe(25);
    expect(monthOf(d)).toBe(6); // still July
  });

  it("counts a SIP due today as due today, not next month", () => {
    const from = new Date(Date.UTC(2026, 6, 25));
    const d = nextSipDate(25, from);
    expect(monthOf(d)).toBe(6);
    expect(dayOf(d)).toBe(25);
  });

  it("rolls into next month once the day has passed", () => {
    // The reported bug: on 31 Jul a SIP on the 25th showed 24 Jul, in the past.
    const from = new Date(Date.UTC(2026, 6, 31));
    const d = nextSipDate(25, from);
    expect(monthOf(d)).toBe(7); // August
    expect(dayOf(d)).toBe(25);
  });

  it("never returns a date before today", () => {
    const from = new Date(Date.UTC(2026, 6, 31));
    for (const day of [1, 4, 12, 25, 28, 31]) {
      const d = nextSipDate(day, from);
      expect(d.getTime()).toBeGreaterThanOrEqual(from.getTime());
    }
  });

  it("clamps to the last day of a short month", () => {
    const from = new Date(Date.UTC(2026, 1, 15)); // 15 Feb 2026
    const d = nextSipDate(31, from);
    expect(monthOf(d)).toBe(1);
    expect(dayOf(d)).toBe(28); // Feb 2026 has 28 days
  });

  it("keeps the requested day regardless of the machine's timezone", () => {
    // Built in UTC, so a day-1 SIP is the 1st and never the 30th of the month
    // before, which is what local-midnight construction produced under IST.
    const d = nextSipDate(1, new Date(Date.UTC(2026, 6, 15)));
    expect(dayOf(d)).toBe(1);
    expect(d.getUTCHours()).toBe(0);
  });
});
