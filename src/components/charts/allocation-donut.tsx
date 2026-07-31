"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatInr, formatInrCompact } from "@/lib/money";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

type Slice = { label: string; value: number };
type TooltipEntry = { name?: string; value?: number };

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = p.value ?? 0;
  return (
    <div className="border-border bg-popover rounded-md border px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium">{p.name}</div>
      <div className="text-muted-foreground num">
        {formatInr(value)} · {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%
      </div>
    </div>
  );
}

export function AllocationDonut({
  data,
  centerLabel = "Total",
}: {
  data: Slice[];
  centerLabel?: string;
}) {
  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={52}
              outerRadius={72}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-muted-foreground text-[10px]">{centerLabel}</span>
          <span className="text-sm font-semibold num">
            {formatInrCompact(total)}
          </span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="text-muted-foreground flex-1 truncate">
              {d.label}
            </span>
            <span className="num">
              {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
