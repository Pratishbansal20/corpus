"use client";

import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { HoldingsTable } from "@/components/holdings/holdings-table";
import { formatPct } from "@/lib/money";
import type { HoldingView } from "@/lib/portfolio/valuation";
import type { SipBankView } from "@/lib/sips/constants";

const WINDOW_LABELS: Record<string, { label: string; title?: string }> = {
  "1M": { label: "1M" },
  "3M": { label: "3M" },
  "6M": { label: "6M" },
  "1Y": { label: "1Y" },
  ALL: { label: "All", title: "Since inception" },
};

function pnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

/**
 * The combined XIRR stat and the fund-holdings table, sharing one window
 * toggle. Deliberately one component owning one piece of state rather than
 * two independently-driven controls: two range pickers that could drift
 * apart is exactly the shape PortfolioTrends already ruled out for the
 * net-worth/returns charts, for the same reason.
 */
export function FundXirrSection({
  windows,
  totalByWindow,
  fundsWithXirrByWindow,
  totalFunds,
  holdings,
  banks,
}: {
  windows: string[];
  totalByWindow: Record<string, number | null>;
  fundsWithXirrByWindow: Record<string, number>;
  totalFunds: number;
  holdings: HoldingView[];
  banks: SipBankView[];
}) {
  const [selected, setSelected] = React.useState(windows[windows.length - 1]);
  const combined = totalByWindow[selected] ?? null;
  const eligible = fundsWithXirrByWindow[selected] ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">XIRR</p>
          {combined !== null ? (
            <>
              <p className={`num mt-1.5 text-lg ${pnlClass(combined)}`}>
                {formatPct(combined)}
              </p>
              <p className="text-muted-foreground text-xs">
                {eligible} of {totalFunds} fund{totalFunds > 1 ? "s" : ""}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground mt-1.5 text-sm">
              Not enough data for this window
            </p>
          )}
        </div>
        <Segmented
          items={windows.map((w) => ({ key: w, ...WINDOW_LABELS[w] }))}
          value={selected}
          onChange={setSelected}
          ariaLabel="XIRR window"
        />
      </div>
      <HoldingsTable
        holdings={holdings}
        banks={banks}
        metric="xirr"
        xirrWindow={selected}
      />
    </div>
  );
}
