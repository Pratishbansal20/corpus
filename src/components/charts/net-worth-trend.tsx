"use client";

import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatInr, formatInrCompact } from "@/lib/money";
import { Segmented } from "@/components/ui/segmented";
import {
  TREND_RANGES,
  niceDomain,
  rangeDays,
  sliceToRange,
  type TrendRangeKey,
} from "@/lib/networth/trend-range";

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
  timeZone: "UTC",
});

const monthFmt = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

export function NetWorthTrend({ data }: { data: Point[] }) {
  const [range, setRange] = useState<TrendRangeKey>("1M");

  const { points, recordedDays, shortOnHistory, domain } = useMemo(() => {
    const days = rangeDays(range);
    // Past about six months a day-and-month tick is noise, so widen the label.
    const fmt = days > 182 ? monthFmt : labelFmt;
    const slice = sliceToRange(data, days);

    return {
      ...slice,
      // Scaled to this window's own values, so each range actually rescales.
      domain: niceDomain(slice.points.map((d) => d.netWorthInr)),
      points: slice.points.map((d) => ({
        ...d,
        label: fmt.format(new Date(d.date)),
      })),
    };
  }, [data, range]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        {/* Left slot stays empty so the control hugs the right edge, and the
            honest note about coverage sits where it will actually be read. */}
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          {shortOnHistory
            ? `${recordedDays} day${recordedDays === 1 ? "" : "s"} recorded so far`
            : `${points.length} day${points.length === 1 ? "" : "s"} shown`}
        </p>
        <Segmented
          items={TREND_RANGES}
          value={range}
          onChange={setRange}
          ariaLabel="Net worth time range"
        />
      </div>

      <div className="h-56 w-full">
        {points.length >= 2 ? (
          <ResponsiveContainer>
            <AreaChart
              data={points}
              margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            >
              <defs>
                <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-1)"
                    stopOpacity={0}
                  />
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
        ) : (
          <div className="border-border text-muted-foreground flex h-full items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-balance">
            No net worth recorded in this window yet.
          </div>
        )}
      </div>
    </div>
  );
}
