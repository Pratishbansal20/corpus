"use client";

import {
  AreaChart,
  Area,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatInrCompact, formatPct, formatSignedInr } from "@/lib/money";

export type ReturnsChartPoint = {
  date: string;
  pnlInr: number;
  pnlPct: number;
  label: string;
};

type TooltipEntry = {
  value?: number;
  payload?: { label?: string; pnlPct?: number };
};

function ReturnsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pnl = p.value ?? 0;
  return (
    <div className="border-border bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{p.payload?.label}</div>
      <div className={`font-medium num ${pnl > 0 ? "text-gain" : pnl < 0 ? "text-loss" : ""}`}>
        {formatSignedInr(pnl)}{" "}
        <span className="text-muted-foreground">
          ({formatPct(p.payload?.pnlPct ?? 0)})
        </span>
      </div>
    </div>
  );
}

/**
 * Where the zero crossing falls within the plotted values, as a fraction from
 * the top (0 = the highest value, 1 = the lowest). Two gradient stops at this
 * same offset give a hard color split rather than a blend, so the line and
 * fill are unambiguously gain-colored above zero and loss-colored below it,
 * not some in-between shade at the crossing.
 *
 * All-positive and all-negative windows collapse to 0 or 1 (solid one
 * color), which is correct: there is nothing to split.
 */
function zeroCrossingOffset(values: readonly number[]): number {
  if (values.length === 0) return 1;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
}

/**
 * Pure chart body: given an already-windowed slice of points and a fitted
 * y-axis domain, just draws it. Range selection and slicing live in
 * `PortfolioTrends`, alongside `NetWorthTrendChart`.
 */
export function ReturnsTrendChart({
  points,
  domain,
  syncId,
}: {
  points: ReturnsChartPoint[];
  domain: [number, number];
  syncId?: string;
}) {
  const offset = `${(zeroCrossingOffset(points.map((p) => p.pnlInr)) * 100).toFixed(2)}%`;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart
          data={points}
          syncId={syncId}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="returnsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset} stopColor="var(--gain)" stopOpacity={0.35} />
              <stop offset={offset} stopColor="var(--loss)" stopOpacity={0.35} />
            </linearGradient>
            <linearGradient id="returnsStroke" x1="0" y1="0" x2="0" y2="1">
              <stop offset={offset} stopColor="var(--gain)" />
              <stop offset={offset} stopColor="var(--loss)" />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={28}
          />
          <YAxis
            width={52}
            domain={domain}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatInrCompact(v)}
          />
          {/* Zero is the line between profit and loss here, unlike net
              worth, which never approaches it: worth marking explicitly. */}
          {domain[0] < 0 && (
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
          )}
          <Tooltip content={<ReturnsTooltip />} />
          <Area
            type="monotone"
            dataKey="pnlInr"
            stroke="url(#returnsStroke)"
            strokeWidth={2}
            fill="url(#returnsFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
