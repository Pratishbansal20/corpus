"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatInr, formatInrCompact } from "@/lib/money";

export type NetWorthChartPoint = {
  date: string;
  netWorthInr: number;
  label: string;
};

type TooltipEntry = { value?: number; payload?: { label?: string } };

function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="border-border bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{p.payload?.label}</div>
      <div className="font-medium num">{formatInr(p.value ?? 0)}</div>
    </div>
  );
}

/**
 * Pure chart body: given an already-windowed slice of points and a fitted
 * y-axis domain, just draws it. Range selection and slicing live in
 * `PortfolioTrends`, which owns both this chart and `ReturnsTrendChart` so
 * they can share one range control and one `syncId` (see that file for why).
 */
export function NetWorthTrendChart({
  points,
  domain,
  syncId,
}: {
  points: NetWorthChartPoint[];
  domain: [number, number];
  syncId?: string;
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart
          data={points}
          syncId={syncId}
          margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
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
          <Tooltip content={<TrendTooltip />} />
          <Area
            type="monotone"
            dataKey="netWorthInr"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#nwFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
