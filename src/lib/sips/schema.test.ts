import { describe, it, expect } from "vitest";
import { nextSipDate, dueDatesBetween } from "./schema";

// Helper: read a date back the way the UI does, in UTC.
const dayOf = (d: Date) => d.getUTCDate();
const monthOf = (d: Date) => d.getUTCMonth();
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("nextSipDate (MONTHLY)", () => {
  it("returns this month when the day is still ahead", () => {
    const from = new Date(Date.UTC(2026, 6, 10)); // 10 Jul 2026
    const d = nextSipDate("MONTHLY", 25, null, from);
    expect(dayOf(d)).toBe(25);
    expect(monthOf(d)).toBe(6); // still July
  });

  it("counts a SIP due today as due today, not next month", () => {
    const from = new Date(Date.UTC(2026, 6, 25));
    const d = nextSipDate("MONTHLY", 25, null, from);
    expect(monthOf(d)).toBe(6);
    expect(dayOf(d)).toBe(25);
  });

  it("rolls into next month once the day has passed", () => {
    // The reported bug: on 31 Jul a SIP on the 25th showed 24 Jul, in the past.
    const from = new Date(Date.UTC(2026, 6, 31));
    const d = nextSipDate("MONTHLY", 25, null, from);
    expect(monthOf(d)).toBe(7); // August
    expect(dayOf(d)).toBe(25);
  });

  it("never returns a date before today", () => {
    const from = new Date(Date.UTC(2026, 6, 31));
    for (const day of [1, 4, 12, 25, 28, 31]) {
      const d = nextSipDate("MONTHLY", day, null, from);
      expect(d.getTime()).toBeGreaterThanOrEqual(from.getTime());
    }
  });

  it("clamps to the last day of a short month", () => {
    const from = new Date(Date.UTC(2026, 1, 15)); // 15 Feb 2026
    const d = nextSipDate("MONTHLY", 31, null, from);
    expect(monthOf(d)).toBe(1);
    expect(dayOf(d)).toBe(28); // Feb 2026 has 28 days
  });

  it("keeps the requested day regardless of the machine's timezone", () => {
    // Built in UTC, so a day-1 SIP is the 1st and never the 30th of the month
    // before, which is what local-midnight construction produced under IST.
    const d = nextSipDate("MONTHLY", 1, null, new Date(Date.UTC(2026, 6, 15)));
    expect(dayOf(d)).toBe(1);
    expect(d.getUTCHours()).toBe(0);
  });
});

describe("dueDatesBetween (MONTHLY)", () => {
  it("returns the one debit that fell in the window", () => {
    const dates = dueDatesBetween(
      "MONTHLY", 4, null, utc(2026, 6, 31), utc(2026, 7, 10),
    );
    expect(dates.map(iso)).toEqual(["2026-08-04"]);
  });

  it("catches up on every debit a missed cron skipped", () => {
    // The cron not running for three months must not lose two debits.
    const dates = dueDatesBetween(
      "MONTHLY", 12, null, utc(2026, 4, 20), utc(2026, 7, 15),
    );
    expect(dates.map(iso)).toEqual(["2026-06-12", "2026-07-12", "2026-08-12"]);
  });

  it("excludes the boundary it starts from, so a debit is never applied twice", () => {
    // `after` is the last debit already applied: it must not come back.
    const dates = dueDatesBetween(
      "MONTHLY", 4, null, utc(2026, 7, 4), utc(2026, 8, 4),
    );
    expect(dates.map(iso)).toEqual(["2026-09-04"]);
  });

  it("includes a debit due today", () => {
    const dates = dueDatesBetween(
      "MONTHLY", 2, null, utc(2026, 6, 15), utc(2026, 7, 2),
    );
    expect(dates.map(iso)).toEqual(["2026-08-02"]);
  });

  it("clamps to month length across a short month", () => {
    // A plan on the 31st debits on the 28th in Feb and the 31st in Mar.
    const dates = dueDatesBetween(
      "MONTHLY", 31, null, utc(2026, 0, 31), utc(2026, 2, 31),
    );
    expect(dates.map(iso)).toEqual(["2026-02-28", "2026-03-31"]);
  });

  it("crosses a year boundary", () => {
    const dates = dueDatesBetween(
      "MONTHLY", 1, null, utc(2026, 10, 5), utc(2027, 0, 10),
    );
    expect(dates.map(iso)).toEqual(["2026-12-01", "2027-01-01"]);
  });

  it("returns nothing when no debit has come due yet", () => {
    expect(
      dueDatesBetween("MONTHLY", 25, null, utc(2026, 7, 1), utc(2026, 7, 10)),
    ).toEqual([]);
  });

  it("returns nothing when the window is inverted or empty", () => {
    expect(
      dueDatesBetween("MONTHLY", 4, null, utc(2026, 7, 10), utc(2026, 7, 1)),
    ).toEqual([]);
    expect(
      dueDatesBetween("MONTHLY", 4, null, utc(2026, 7, 10), utc(2026, 7, 10)),
    ).toEqual([]);
  });
});

describe("nextSipDate (WEEKLY)", () => {
  // dayOfMonth doubles as day-of-week for WEEKLY: 0 Sun .. 6 Sat.
  it("returns today when today is already the target day", () => {
    const from = utc(2026, 7, 12); // 12 Aug 2026 is a Wednesday (3)
    const d = nextSipDate("WEEKLY", 3, null, from);
    expect(iso(d)).toBe("2026-08-12");
  });

  it("rolls forward to the next matching weekday", () => {
    const from = utc(2026, 7, 12); // Wednesday
    const d = nextSipDate("WEEKLY", 5, null, from); // next Friday
    expect(iso(d)).toBe("2026-08-14");
  });

  it("wraps to next week when the target day already passed this week", () => {
    const from = utc(2026, 7, 12); // Wednesday
    const d = nextSipDate("WEEKLY", 1, null, from); // Monday, 6 days later
    expect(iso(d)).toBe("2026-08-17");
  });

  it("ignores applyFrom entirely: weekly doesn't have a monthly phase", () => {
    const from = utc(2026, 7, 12);
    const withAnchor = nextSipDate("WEEKLY", 3, utc(2026, 0, 1), from);
    const withoutAnchor = nextSipDate("WEEKLY", 3, null, from);
    expect(iso(withAnchor)).toBe(iso(withoutAnchor));
  });
});

describe("dueDatesBetween (WEEKLY)", () => {
  it("returns every occurrence of the weekday in the window", () => {
    // Wednesdays between 5 Aug and 26 Aug 2026: 12, 19, 26.
    const dates = dueDatesBetween(
      "WEEKLY", 3, null, utc(2026, 7, 5), utc(2026, 7, 26),
    );
    expect(dates.map(iso)).toEqual(["2026-08-12", "2026-08-19", "2026-08-26"]);
  });

  it("excludes the boundary it starts from", () => {
    const dates = dueDatesBetween(
      "WEEKLY", 3, null, utc(2026, 7, 12), utc(2026, 7, 19),
    );
    expect(dates.map(iso)).toEqual(["2026-08-19"]);
  });
});

describe("nextSipDate (QUARTERLY)", () => {
  it("stays in the current qualifying month when the day is still ahead", () => {
    const applyFrom = utc(2026, 2, 1); // created in March: cycle is Mar/Jun/Sep/Dec
    const from = utc(2026, 2, 10); // 10 Mar 2026
    const d = nextSipDate("QUARTERLY", 15, applyFrom, from);
    expect(iso(d)).toBe("2026-03-15");
  });

  it("skips to the next qualifying month, not just the next month", () => {
    const applyFrom = utc(2026, 2, 1); // Mar/Jun/Sep/Dec cycle
    const from = utc(2026, 3, 1); // April: doesn't qualify
    const d = nextSipDate("QUARTERLY", 15, applyFrom, from);
    expect(iso(d)).toBe("2026-06-15");
  });

  it("respects a different phase for a plan created in a different month", () => {
    const applyFrom = utc(2026, 3, 1); // April: cycle is Apr/Jul/Oct/Jan
    const from = utc(2026, 3, 20); // day already passed this April
    const d = nextSipDate("QUARTERLY", 10, applyFrom, from);
    expect(iso(d)).toBe("2026-07-10");
  });

  it("clamps to month length in a qualifying short month", () => {
    const applyFrom = utc(2025, 10, 1); // Nov: cycle is Nov/Feb/May/Aug
    const from = utc(2026, 1, 1); // Feb 2026 (28 days)
    const d = nextSipDate("QUARTERLY", 30, applyFrom, from);
    expect(iso(d)).toBe("2026-02-28");
  });
});

describe("dueDatesBetween (QUARTERLY)", () => {
  it("returns only qualifying months in the window", () => {
    const applyFrom = utc(2026, 2, 1); // Mar/Jun/Sep/Dec
    const dates = dueDatesBetween(
      "QUARTERLY", 15, applyFrom, utc(2026, 1, 1), utc(2026, 8, 30),
    );
    expect(dates.map(iso)).toEqual(["2026-03-15", "2026-06-15", "2026-09-15"]);
  });

  it("catches up on a missed quarter, not every month in between", () => {
    const applyFrom = utc(2026, 2, 1);
    const dates = dueDatesBetween(
      "QUARTERLY", 1, applyFrom, utc(2026, 2, 1), utc(2026, 11, 31),
    );
    expect(dates.map(iso)).toEqual(["2026-06-01", "2026-09-01", "2026-12-01"]);
  });
});
