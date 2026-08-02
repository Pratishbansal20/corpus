import { describe, it, expect } from "vitest";
import { nextSipDate, dueDatesBetween } from "./schema";

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

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("dueDatesBetween", () => {
  it("returns the one debit that fell in the window", () => {
    const dates = dueDatesBetween(4, utc(2026, 6, 31), utc(2026, 7, 10));
    expect(dates.map(iso)).toEqual(["2026-08-04"]);
  });

  it("catches up on every debit a missed cron skipped", () => {
    // The cron not running for three months must not lose two debits.
    const dates = dueDatesBetween(12, utc(2026, 4, 20), utc(2026, 7, 15));
    expect(dates.map(iso)).toEqual(["2026-06-12", "2026-07-12", "2026-08-12"]);
  });

  it("excludes the boundary it starts from, so a debit is never applied twice", () => {
    // `after` is the last debit already applied: it must not come back.
    const dates = dueDatesBetween(4, utc(2026, 7, 4), utc(2026, 8, 4));
    expect(dates.map(iso)).toEqual(["2026-09-04"]);
  });

  it("includes a debit due today", () => {
    const dates = dueDatesBetween(2, utc(2026, 6, 15), utc(2026, 7, 2));
    expect(dates.map(iso)).toEqual(["2026-08-02"]);
  });

  it("clamps to month length across a short month", () => {
    // A plan on the 31st debits on the 28th in Feb and the 31st in Mar.
    const dates = dueDatesBetween(31, utc(2026, 0, 31), utc(2026, 2, 31));
    expect(dates.map(iso)).toEqual(["2026-02-28", "2026-03-31"]);
  });

  it("crosses a year boundary", () => {
    const dates = dueDatesBetween(1, utc(2026, 10, 5), utc(2027, 0, 10));
    expect(dates.map(iso)).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("returns nothing when no debit has come due yet", () => {
    expect(dueDatesBetween(25, utc(2026, 7, 1), utc(2026, 7, 10))).toEqual([]);
  });

  it("returns nothing when the window is inverted or empty", () => {
    expect(dueDatesBetween(4, utc(2026, 7, 10), utc(2026, 7, 1))).toEqual([]);
    expect(dueDatesBetween(4, utc(2026, 7, 10), utc(2026, 7, 10))).toEqual([]);
  });
});
