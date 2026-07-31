import { formatInr } from "@/lib/money";

export type CompositionSegment = {
  label: string;
  value: number;
  href?: string;
};

const SEGMENT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-3)",
];

/**
 * The composition line: this product's thesis as a graphic.
 *
 * Everything you own, resolved onto a single rule: one segment per place the
 * money actually lives. What you owe hangs *below* the line, drawn to the same
 * scale, so "assets minus liabilities" is legible at a glance rather than
 * something you have to compute from two separate cards.
 */
export function CompositionLine({
  segments,
  liabilitiesInr = 0,
  liabilitiesLabel = "Owed",
}: {
  segments: CompositionSegment[];
  liabilitiesInr?: number;
  liabilitiesLabel?: string;
}) {
  const present = segments.filter((s) => s.value > 0);
  const total = present.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return null;

  const liabilityPct = Math.min((liabilitiesInr / total) * 100, 100);

  return (
    <div className="flex flex-col gap-3">
      <div>
        {/* The line itself. */}
        <div className="flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full">
          {present.map((s, i) => (
            <div
              key={s.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(s.value / total) * 100}%`,
                background: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              }}
            />
          ))}
        </div>

        {/* What you owe, drawn to the same scale, hanging below the line. A
            floor on the width keeps a small debt legible as a deliberate mark
            rather than a stray pixel. */}
        {liabilitiesInr > 0 && (
          <div className="mt-[3px] flex justify-end">
            <div
              className="bg-loss/80 h-1 min-w-6 rounded-full"
              style={{ width: `${liabilityPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Legend */}
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {present.map((s, i) => (
          <li key={s.label} className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 translate-y-[-1px] rounded-full"
              style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            />
            <span className="text-muted-foreground text-sm">{s.label}</span>
            <span className="num text-sm">{formatInr(s.value)}</span>
            <span className="text-muted-foreground num text-xs">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
        {liabilitiesInr > 0 && (
          <li className="flex items-baseline gap-2">
            <span
              aria-hidden
              className="bg-loss/70 size-2 shrink-0 translate-y-[-1px] rounded-full"
            />
            <span className="text-muted-foreground text-sm">
              {liabilitiesLabel}
            </span>
            <span className="num text-loss text-sm">
              −{formatInr(liabilitiesInr)}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
