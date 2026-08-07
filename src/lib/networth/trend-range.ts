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
/**
 * A y-axis window that fits the values actually on screen.
 *
 * recharts defaults a numeric y-axis to `[0, 'auto']`, which anchors the scale
 * at zero. For a net worth hovering around 3.4 lakh that puts every point in
 * the top fifth of the plot, fills the area solid beneath them, and flattens
 * the line into a block: a 20k move looks like nothing. Worse, since the top
 * of the scale is the maximum and the maximum is similar in every window,
 * switching range barely changed the picture, so the ranges looked broken.
 *
 * Fitting the window to its own data is what makes the ranges mean something.
 * The tradeoff is the usual one: a scale that does not start at zero
 * exaggerates small moves, which is the right call for a trend line whose
 * whole job is showing change, and the axis labels state the real figures.
 */
export function niceDomain(
  values: readonly number[],
  padRatio = 0.08,
): [number, number] {
  if (values.length === 0) return [0, 1];

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    // One point, or a genuinely flat stretch. Without a band the axis
    // collapses and the line is drawn on the edge of the plot.
    const band = Math.max(Math.abs(min) * 0.01, 1);
    min -= band;
    max += band;
  }

  const pad = (max - min) * padRatio;
  const step = niceStep(max + pad - (min - pad));

  let lo = Math.floor((min - pad) / step) * step;
  const hi = Math.ceil((max + pad) / step) * step;

  // Never show a negative axis for a series that never goes negative: the
  // empty space below zero says nothing and costs resolution.
  if (min >= 0 && lo < 0) lo = 0;

  return [lo, hi];
}

/** A round step (1, 2 or 5 times a power of ten) giving roughly four ticks. */
function niceStep(spread: number): number {
  if (!Number.isFinite(spread) || spread <= 0) return 1;
  const rough = spread / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * magnitude;
}

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
