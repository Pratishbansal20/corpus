import { describe, it, expect } from "vitest";
import {
  sliceToRange,
  rangeDays,
  TREND_RANGES,
  TREND_MAX_DAYS,
} from "./trend-range";

/** `n` daily points ending on 2026-08-02, ascending. */
function series(n: number) {
  const end = Date.UTC(2026, 7, 2);
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(end - (n - 1 - i) * 86_400_000).toISOString(),
    netWorthInr: 1000 + i,
  }));
}

describe("sliceToRange", () => {
  it("keeps only the last month when history runs longer", () => {
    const { points, shortOnHistory } = sliceToRange(series(400), 30);
    expect(points).toHaveLength(31); // 30 days back, inclusive of both ends
    expect(points.at(-1)!.date.slice(0, 10)).toBe("2026-08-02");
    expect(points[0].date.slice(0, 10)).toBe("2026-07-03");
    expect(shortOnHistory).toBe(false);
  });

  it("widens correctly for each longer range", () => {
    const data = series(2000);
    expect(sliceToRange(data, rangeDays("3M")).points).toHaveLength(92);
    expect(sliceToRange(data, rangeDays("1Y")).points).toHaveLength(366);
    expect(sliceToRange(data, rangeDays("5Y")).points).toHaveLength(1827);
  });

  it("returns everything, and flags it, when the window exceeds history", () => {
    // The live case: 28 days recorded, 5Y selected. Showing all 28 is right,
    // but the caller has to be able to say so instead of looking broken.
    const { points, recordedDays, shortOnHistory } = sliceToRange(
      series(28),
      TREND_MAX_DAYS,
    );
    expect(points).toHaveLength(28);
    expect(recordedDays).toBe(28);
    expect(shortOnHistory).toBe(true);
  });

  it("measures the window from the newest point, not from today", () => {
    // A series that stopped six months ago still shows its own last month,
    // rather than an empty chart, and stays stable between server and browser.
    const stale = Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString(),
      netWorthInr: i,
    }));
    const { points } = sliceToRange(stale, 30);
    expect(points.at(-1)!.date.slice(0, 10)).toBe("2025-03-31");
    expect(points).toHaveLength(31);
  });

  it("handles an empty series without dividing by nothing", () => {
    expect(sliceToRange([], 30)).toEqual({
      points: [],
      recordedDays: 0,
      shortOnHistory: true,
    });
  });

  it("offers exactly the ranges the chart advertises, shortest first", () => {
    expect(TREND_RANGES.map((r) => r.key)).toEqual([
      "1W",
      "1M",
      "3M",
      "6M",
      "1Y",
      "3Y",
      "5Y",
    ]);
    // The server must load at least as far back as the widest range.
    expect(TREND_MAX_DAYS).toBe(1826);
  });

  it("narrows to a week", () => {
    const { points, shortOnHistory } = sliceToRange(series(400), rangeDays("1W"));
    expect(points).toHaveLength(8); // 7 days back, inclusive of both ends
    expect(points[0].date.slice(0, 10)).toBe("2026-07-26");
    expect(points.at(-1)!.date.slice(0, 10)).toBe("2026-08-02");
    expect(shortOnHistory).toBe(false);
  });
});
