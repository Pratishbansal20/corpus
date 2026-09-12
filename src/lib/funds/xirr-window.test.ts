import { describe, expect, it } from "vitest";
import {
  buildFundWindowFlows,
  computeFundXirrForWindow,
  type FundXirrTransaction,
} from "./xirr-window";
import type { NavHistory } from "@/lib/portfolio/providers/mfapi-nav-history";

const DAY_MS = 86_400_000;
const today = new Date("2026-09-13T00:00:00.000Z");
function daysAgo(days: number): Date {
  return new Date(today.getTime() - days * DAY_MS);
}

function buy(date: Date, quantity: number, amount: number): FundXirrTransaction {
  return { date, type: "BUY", quantity, amount };
}

function navHistoryFrom(entries: [string, number][]): NavHistory {
  return {
    schemeCode: "TEST",
    navByDate: new Map(entries),
    dates: entries.map(([d]) => d).sort(),
  };
}

describe("buildFundWindowFlows: ALL (since inception)", () => {
  it("needs no NAV history at all", () => {
    const txns = [buy(daysAgo(400), 100, 1000)];
    const flows = buildFundWindowFlows(txns, null, 1200, "ALL", today);
    expect(flows).not.toBeNull();
    expect(flows).toHaveLength(2);
    expect(flows![0].amount).toBe(-1000);
    expect(flows![1]).toEqual({ date: today, amount: 1200 });
  });
});

describe("buildFundWindowFlows: a trailing window", () => {
  it("adds no synthetic starting flow when the position didn't exist before the window", () => {
    // Everything happened inside the 3M window - nothing to price at the start.
    const txns = [buy(daysAgo(30), 100, 1000)];
    const flows = buildFundWindowFlows(txns, null, 1100, "3M", today);
    expect(flows).toHaveLength(2); // the real buy + the final value, no starting flow
    expect(flows![0].amount).toBe(-1000);
  });

  it("prices the pre-existing position at the window's start using NAV history", () => {
    const windowStart = new Date(today.getTime() - 91 * DAY_MS); // "3M"
    const nav = navHistoryFrom([
      ["2026-06-01", 10],
      [windowStart.toISOString().slice(0, 10), 12], // NAV exactly on the boundary
    ]);
    // Bought 100 units well before the window; nothing new bought inside it.
    const txns = [buy(daysAgo(200), 100, 1000)];
    const flows = buildFundWindowFlows(txns, nav, 1300, "3M", today);
    expect(flows).not.toBeNull();
    // Starting synthetic flow: -(100 units * NAV 12) = -1200, then the final value.
    expect(flows).toHaveLength(2);
    expect(flows![0].amount).toBeCloseTo(-1200, 6);
    expect(flows![1]).toEqual({ date: today, amount: 1300 });
  });

  it("includes both the starting position and real in-window purchases", () => {
    const nav = navHistoryFrom([["2026-01-01", 10]]);
    const txns = [
      buy(daysAgo(200), 100, 1000), // before the window: priced at the start via NAV
      buy(daysAgo(10), 50, 600), // inside the window: a real flow
    ];
    const flows = buildFundWindowFlows(txns, nav, 2000, "3M", today);
    expect(flows).toHaveLength(3); // starting synthetic + the in-window buy + final value
    expect(flows![0].amount).toBeCloseTo(-1000, 6); // 100 units * NAV 10
    expect(flows![1].amount).toBe(-600);
  });

  it("returns null when a position existed before the window but no NAV history is available", () => {
    const txns = [buy(daysAgo(200), 100, 1000)];
    expect(buildFundWindowFlows(txns, null, 1300, "3M", today)).toBeNull();
  });

  it("returns null when the fund's NAV history doesn't reach back to the window's start", () => {
    // History only starts a week before the window's start date - too short.
    const nav = navHistoryFrom([["2026-08-01", 10]]); // well after the 3M window's start
    const txns = [buy(daysAgo(200), 100, 1000)];
    expect(buildFundWindowFlows(txns, nav, 1300, "3M", today)).toBeNull();
  });

  it("returns null when nothing was held and nothing was bought in the window", () => {
    expect(buildFundWindowFlows([], null, 0, "1M", today)).toBeNull();
  });

  it("a DIVIDEND transaction never changes the quantity carried into the window", () => {
    const nav = navHistoryFrom([["2026-01-01", 10]]);
    const txns: FundXirrTransaction[] = [
      buy(daysAgo(200), 100, 1000),
      { date: daysAgo(150), type: "DIVIDEND", quantity: 0, amount: 50 },
    ];
    const flows = buildFundWindowFlows(txns, nav, 1300, "3M", today);
    // Still exactly 100 units at the window start, not affected by the dividend.
    expect(flows![0].amount).toBeCloseTo(-1000, 6);
  });
});

describe("computeFundXirrForWindow", () => {
  it("returns a sane positive rate for a straightforward gain", () => {
    const rate = computeFundXirrForWindow(
      [buy(daysAgo(365), 100, 1000)],
      null,
      1100,
      "ALL",
      today,
    );
    expect(rate).not.toBeNull();
    expect(rate!).toBeGreaterThan(0);
  });

  it("propagates null the same way buildFundWindowFlows does", () => {
    expect(
      computeFundXirrForWindow([buy(daysAgo(200), 100, 1000)], null, 1300, "3M", today),
    ).toBeNull();
  });
});
