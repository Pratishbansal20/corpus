// Trailing-window XIRR for a single fund: "1M"/"3M"/"6M"/"1Y" (real windows
// reuse the net-worth trend chart's own day counts, not a separate
// definition) plus "ALL" (since inception). Pure and Prisma-free like every
// other calculation module here - takes already-fetched transactions and an
// already-fetched NavHistory as plain data, never touches the network or a
// database itself.
import type { TransactionType } from "@/generated/prisma";
import { computeXirr, type CashFlow } from "@/lib/portfolio/xirr";
import {
  resolveNavAsOf,
  type NavHistory,
} from "@/lib/portfolio/providers/mfapi-nav-history";
import { rangeDays, type TrendRangeKey } from "@/lib/networth/trend-range";

export type FundXirrWindow = TrendRangeKey | "ALL";

// A subset of the trend chart's own ranges, not all of them: 1W is too
// noisy to annualize meaningfully, and 3Y/5Y would report "not enough data"
// for every fund in this app today (the oldest holding here is about 18
// months old) - pure clutter for zero payoff right now. Nothing here stops
// adding them later; the math already supports any window.
export const FUND_XIRR_WINDOWS: FundXirrWindow[] = ["1M", "3M", "6M", "1Y", "ALL"];

const DAY_MS = 86_400_000;

export type FundXirrTransaction = {
  date: Date;
  type: TransactionType;
  quantity: number;
  amount: number; // native currency, as Transaction.amount is stored
};

function signedAmount(t: FundXirrTransaction): number {
  return t.type === "BUY" ? -t.amount : t.amount;
}

function signedQuantity(t: FundXirrTransaction): number {
  if (t.type === "BUY") return t.quantity;
  if (t.type === "SELL") return -t.quantity;
  return 0; // DIVIDEND: cash only, never changes units held
}

/**
 * The cash-flow list a window's XIRR would be computed from, or null when it
 * can't be built (a real position existed going into the window, but the
 * fund's own NAV history doesn't reach back that far to price it). Exposed
 * separately from `computeFundXirrForWindow` so a combined multi-fund figure
 * can concatenate several funds' flow lists before calling `computeXirr`
 * once, rather than only being able to combine already-final rates.
 */
export function buildFundWindowFlows(
  transactions: FundXirrTransaction[],
  navHistory: NavHistory | null,
  currentValueInr: number,
  window: FundXirrWindow,
  today: Date,
): CashFlow[] | null {
  const sorted = [...transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  if (window === "ALL") {
    const flows: CashFlow[] = sorted.map((t) => ({
      date: t.date,
      amount: signedAmount(t),
    }));
    flows.push({ date: today, amount: currentValueInr });
    return flows;
  }

  const windowStart = new Date(today.getTime() - rangeDays(window) * DAY_MS);

  const quantityAtStart = sorted
    .filter((t) => t.date.getTime() <= windowStart.getTime())
    .reduce((sum, t) => sum + signedQuantity(t), 0);

  const flows: CashFlow[] = [];
  if (quantityAtStart > 0) {
    // A real position already existed going into this window - it has to be
    // priced at the window's start, or the window's return would silently
    // ignore whatever that position was already worth.
    if (!navHistory) return null;
    const navAtStart = resolveNavAsOf(navHistory, windowStart);
    if (!navAtStart) return null; // the fund's own history doesn't reach back this far
    flows.push({
      date: windowStart,
      amount: -(quantityAtStart * navAtStart.nav),
    });
  }

  for (const t of sorted) {
    if (t.date.getTime() > windowStart.getTime()) {
      flows.push({ date: t.date, amount: signedAmount(t) });
    }
  }

  if (flows.length === 0) return null; // nothing held or bought in this window
  flows.push({ date: today, amount: currentValueInr });
  return flows;
}

export function computeFundXirrForWindow(
  transactions: FundXirrTransaction[],
  navHistory: NavHistory | null,
  currentValueInr: number,
  window: FundXirrWindow,
  today: Date,
): number | null {
  const flows = buildFundWindowFlows(
    transactions,
    navHistory,
    currentValueInr,
    window,
    today,
  );
  return flows === null ? null : computeXirr(flows);
}
