"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type OverlapFund = {
  id: string;
  name: string;
  hasSip: boolean;
};

export type OverlapEntry = {
  aId: string;
  bId: string;
  overlapPct: number;
  commonStocks: number;
};

function overlapColor(pct: number): string {
  // 0 to 22%+ mapped onto an increasing brass tint.
  const a = Math.min(pct / 22, 1);
  return `color-mix(in oklch, var(--chart-1) ${Math.round(a * 100)}%, transparent)`;
}

const shortName = (name: string) =>
  name.replace(/ (Fund|Direct|Growth|Plan|Cap).*$/i, "").slice(0, 14);

/**
 * Overlap between funds, with a tab to narrow the grid to just the funds being
 * bought every month. Duplication inside an active SIP is the case worth acting
 * on, because that is the money still going in.
 */
export function OverlapMatrix({
  funds,
  overlaps,
}: {
  funds: OverlapFund[];
  overlaps: OverlapEntry[];
}) {
  const sipFunds = funds.filter((f) => f.hasSip);
  const canFilter = sipFunds.length > 1;
  const [scope, setScope] = useState<"sip" | "all">(canFilter ? "sip" : "all");

  const shown = scope === "sip" && canFilter ? sipFunds : funds;

  const lookup = new Map<string, number>();
  for (const o of overlaps) {
    lookup.set(`${o.aId}|${o.bId}`, o.overlapPct);
    lookup.set(`${o.bId}|${o.aId}`, o.overlapPct);
  }

  return (
    <div className="flex flex-col gap-3">
      {canFilter && (
        <div
          role="tablist"
          aria-label="Which funds to compare"
          className="bg-muted/60 flex w-fit gap-1 rounded-lg p-1"
        >
          {(
            [
              ["sip", `Active SIPs (${sipFunds.length})`],
              ["all", `All funds (${funds.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={scope === key}
              onClick={() => setScope(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                scope === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {shown.length > 3 && (
        <p className="text-muted-foreground text-xs sm:hidden">
          Scroll horizontally to see all funds
        </p>
      )}

      <div className="overflow-x-auto">
        {/* w-max (not w-full) so the parent's overflow-x-auto actually scrolls
            on narrow screens instead of squishing every column to fit. */}
        <table className="w-max border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="text-left font-normal" />
              {shown.map((f) => (
                <th
                  key={f.id}
                  className="text-muted-foreground min-w-14 px-1 text-center font-normal"
                >
                  {shortName(f.name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td className="text-muted-foreground pr-2 whitespace-nowrap">
                  {shortName(row.name)}
                </td>
                {shown.map((col) => {
                  if (row.id === col.id) {
                    return (
                      <td
                        key={col.id}
                        className="text-muted-foreground/40 min-w-14 text-center"
                      >
                        ·
                      </td>
                    );
                  }
                  const pct = lookup.get(`${row.id}|${col.id}`) ?? 0;
                  return (
                    <td
                      key={col.id}
                      className="num min-w-14 rounded-md text-center"
                      style={{ background: overlapColor(pct) }}
                    >
                      {pct.toFixed(0)}%
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
