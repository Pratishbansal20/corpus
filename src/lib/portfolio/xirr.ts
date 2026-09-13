// XIRR: the annualized rate that makes a stream of dated cash flows net to
// zero (Newton-Raphson, bisection fallback) - the standard portfolio-return
// measure every real brokerage shows, because it accounts for *when* each
// rupee went in, not just how much. Pure and Prisma-free, same as every other
// calculation module in this app (sips/math.ts, networth/trend-range.ts):
// testable without a database, and the only place this math lives.
//
// A negative amount is money leaving the investor's pocket (a BUY); a
// positive one is money arriving (a SELL, a DIVIDEND, or the synthetic final
// flow a caller adds for "what this position is worth today, as if sold").
// This function does not know or care which asset class the flows came from
// - it is entirely general. What limits it to mutual funds in this app today
// is a data-quality decision made by the caller (`isTrustworthyDateSource`
// below), not anything in the math itself.
export type CashFlow = {
  date: Date;
  amount: number;
};

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;
const MAX_NEWTON_ITERATIONS = 100;
const TOLERANCE = 1e-7;

function yearsBetween(from: number, to: number): number {
  return (to - from) / MS_PER_DAY / DAYS_PER_YEAR;
}

function npv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, f) => {
    const years = yearsBetween(t0, f.date.getTime());
    return sum + f.amount / Math.pow(1 + rate, years);
  }, 0);
}

function npvDerivative(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, f) => {
    const years = yearsBetween(t0, f.date.getTime());
    if (years === 0) return sum;
    return sum - (years * f.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

/**
 * The annualized rate (a fraction: 0.12 means 12%/year), or null when no
 * rate could be found - too few flows, every flow the same sign (nothing to
 * solve: money only ever left or only ever arrived), or the search
 * genuinely doesn't converge. Never throws: a XIRR that can't be computed is
 * reported as "not available," the same "last good, never fabricated"
 * contract every provider in this app already follows.
 */
export function computeXirr(flows: CashFlow[]): number | null {
  if (flows.length < 2) return null;

  const hasInflow = flows.some((f) => f.amount > 0);
  const hasOutflow = flows.some((f) => f.amount < 0);
  if (!hasInflow || !hasOutflow) return null;

  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();

  // Newton-Raphson from a middle-of-the-road guess. Converges in a handful
  // of iterations for anything shaped like a real investment history.
  let rate = 0.1;
  for (let i = 0; i < MAX_NEWTON_ITERATIONS; i++) {
    const value = npv(rate, sorted, t0);
    const derivative = npvDerivative(rate, sorted, t0);
    if (Math.abs(derivative) < 1e-12) break;

    const next = rate - value / derivative;
    if (!Number.isFinite(next) || next <= -1) break;
    if (Math.abs(next - rate) < TOLERANCE) return next;
    rate = next;
  }

  // Newton diverged (a bad guess, or a pathological cash-flow shape) - fall
  // back to bisection over a wide but bounded range: -99.99%/year to
  // +1000%/year covers every realistic (and most unrealistic) outcomes.
  let lo = -0.9999;
  let hi = 10;
  let npvLo = npv(lo, sorted, t0);
  const npvHi = npv(hi, sorted, t0);
  if (Math.sign(npvLo) === Math.sign(npvHi)) return null; // no root in range

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid, sorted, t0);
    if (Math.abs(npvMid) < TOLERANCE) return mid;
    if (Math.sign(npvMid) === Math.sign(npvLo)) {
      lo = mid;
      npvLo = npvMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

// Which Transaction.source values carry a real, trusted cash-flow date. A
// row written by createHolding ("MANUAL_ENTRY") or the CAS backfill's
// opening-balance stub ("OPENING_BALANCE") records the day it was *typed
// in*, not the day money actually moved - feeding either into XIRR would
// produce a number that looks precise and is actually fiction. Exported so
// the one caller that needs it (lib/funds/queries.ts) doesn't have to guess
// at which source strings are safe.
const TRUSTWORTHY_DATE_SOURCES = new Set(["SIP", "TOPUP", "CAS_IMPORT"]);

export function isTrustworthyDateSource(source: string): boolean {
  return TRUSTWORTHY_DATE_SOURCES.has(source);
}
