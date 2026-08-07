// Range windows for the net-worth trend chart, kept out of the chart component
// so the date arithmetic can be tested without mounting recharts.

export const TREND_RANGES = [
  { key: "1W", label: "1W", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 91 },
  { key: "6M", label: "6M", days: 182 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "3Y", label: "3Y", days: 1095 },
  { key: "5Y", label: "5Y", days: 1826 },
] as const;

export type TrendRangeKey = (typeof TREND_RANGES)[number]["key"];

/** The furthest back any range reaches: what the server needs to load. */
export const TREND_MAX_DAYS = TREND_RANGES[TREND_RANGES.length - 1].days;

export function rangeDays(key: TrendRangeKey): number {
  return TREND_RANGES.find((r) => r.key === key)?.days ?? TREND_MAX_DAYS;
}

const DAY_MS = 86_400_000;

export type TrendSlice<T> = {
  points: T[];
  /** Days between the oldest and newest record, inclusive. */
  recordedDays: number;
  /** True when the window reaches further back than any recorded data. */
  shortOnHistory: boolean;
};

/**
 * Narrow an ascending series to the last `days` of recorded history.
 *
 * The window is measured back from the **newest recorded point**, not the wall
 * clock. Two reasons: reading a clock during render is impure and would let the
 * server and the browser disagree at hydration, and after a gap in refreshes
 * "1M" should still show the last month of data that exists rather than an
 * empty chart.
 */
export function sliceToRange<T extends { date: string }>(
  data: readonly T[],
  days: number,
): TrendSlice<T> {
  if (data.length === 0) {
    return { points: [], recordedDays: 0, shortOnHistory: true };
  }

  const newest = Date.parse(data[data.length - 1].date);
  const oldest = Date.parse(data[0].date);
  const cutoff = newest - days * DAY_MS;
  const recordedDays = Math.round((newest - oldest) / DAY_MS) + 1;

  return {
    points: data.filter((d) => Date.parse(d.date) >= cutoff),
    recordedDays,
    shortOnHistory: days > recordedDays,
  };
}
