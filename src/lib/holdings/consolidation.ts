import type { HoldingView } from "@/lib/portfolio/valuation";

// Human label for a broker/app source code.
export const SOURCE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  GROWW: "Groww",
  PAYTM_MONEY: "Paytm Money",
  INDMONEY: "INDmoney",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

export type AppGroup = {
  source: string;
  label: string;
  valueInr: number;
  investedInr: number;
  pnlInr: number;
  pnlPct: number;
  count: number;
  weightPct: number;
};

export type AppConsolidation = {
  groups: AppGroup[];
  totalValueInr: number;
};

// "Where do my investments live?": collapse holdings by the app/broker they
// came from, so the user sees Groww vs Paytm Money vs INDmoney at a glance.
export function consolidateBySource(holdings: HoldingView[]): AppConsolidation {
  const bySource = new Map<string, AppGroup>();

  for (const h of holdings) {
    const g = bySource.get(h.source) ?? {
      source: h.source,
      label: sourceLabel(h.source),
      valueInr: 0,
      investedInr: 0,
      pnlInr: 0,
      pnlPct: 0,
      count: 0,
      weightPct: 0,
    };
    g.valueInr += h.currentValueInr;
    g.investedInr += h.investedInr;
    g.pnlInr += h.pnlInr;
    g.count += 1;
    bySource.set(h.source, g);
  }

  const totalValueInr = holdings.reduce((a, h) => a + h.currentValueInr, 0);

  const groups = [...bySource.values()]
    .map((g) => ({
      ...g,
      pnlPct: g.investedInr > 0 ? (g.pnlInr / g.investedInr) * 100 : 0,
      weightPct: totalValueInr > 0 ? (g.valueInr / totalValueInr) * 100 : 0,
    }))
    .sort((a, b) => b.valueInr - a.valueInr);

  return { groups, totalValueInr };
}
