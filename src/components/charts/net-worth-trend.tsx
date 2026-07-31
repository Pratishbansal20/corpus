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

type Point = { date: string; netWorthInr: number };
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

const labelFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

export function NetWorthTrend({ data }: { data: Point[] }) {
  const points = data.map((d) => ({
    ...d,
    label: labelFmt.format(new Date(d.date)),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
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
