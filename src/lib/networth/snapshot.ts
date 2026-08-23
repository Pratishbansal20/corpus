import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { TREND_MAX_DAYS } from "./trend-range";
import { getUserPortfolio } from "@/lib/holdings/queries";
import {
  getBankAccounts,
  getManualAssets,
  sumBalances,
  sumAssetValues,
} from "@/lib/accounts/queries";
import { getCreditCards, sumOutstanding } from "@/lib/cards/queries";
import { computeNetWorth } from "./compute";

// UTC start-of-day so there is exactly one upserted snapshot per calendar day,
// regardless of when (or how often) a refresh runs.
function startOfUtcDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Compute the user's current net worth and upsert today's snapshot. Called from
 * the manual refresh action and the daily cron so the trend chart accrues history.
 */
export async function writeDailyNetWorthSnapshot(userId: string): Promise<void> {
  const [portfolio, banks, assets, cards] = await Promise.all([
    getUserPortfolio(userId),
    getBankAccounts(userId),
    getManualAssets(userId),
    getCreditCards(userId),
  ]);

  const nw = computeNetWorth({
    investmentsInr: portfolio.summary.totalValueInr,
    bankInr: sumBalances(banks),
    otherAssetsInr: sumAssetValues(assets),
    cardOutstandingInr: sumOutstanding(cards),
  });

  const asOf = startOfUtcDay();
  const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

  await prisma.portfolioSnapshot.upsert({
    where: { userId_asOf: { userId, asOf } },
    update: {
      totalValueInr: D(portfolio.summary.totalValueInr),
      investedInr: D(portfolio.summary.investedInr),
      netWorthInr: D(nw.netWorthInr),
      totalAssetsInr: D(nw.totalAssetsInr),
      totalLiabilitiesInr: D(nw.totalLiabilitiesInr),
    },
    create: {
      userId,
      asOf,
      totalValueInr: D(portfolio.summary.totalValueInr),
      investedInr: D(portfolio.summary.investedInr),
      netWorthInr: D(nw.netWorthInr),
      totalAssetsInr: D(nw.totalAssetsInr),
      totalLiabilitiesInr: D(nw.totalLiabilitiesInr),
    },
  });
}

export type NetWorthPoint = {
  date: string; // ISO
  netWorthInr: number;
  totalAssetsInr: number;
};

export type ReturnsPoint = {
  date: string; // ISO
  pnlInr: number;
  pnlPct: number;
  investedInr: number;
  valueInr: number;
};

/**
 * Default window: the widest range the trend chart offers. Loading only 90 days
 * would have made 1Y and beyond quietly show the same 90 days. One row per day
 * per user, so even the full span is a few thousand small rows.
 */
export async function getNetWorthHistory(
  userId: string,
  days = TREND_MAX_DAYS,
): Promise<NetWorthPoint[]> {
  const since = startOfUtcDay();
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await prisma.portfolioSnapshot.findMany({
    where: { userId, asOf: { gte: since } },
    orderBy: { asOf: "asc" },
  });

  return rows.map((r) => ({
    date: r.asOf.toISOString(),
    netWorthInr: r.netWorthInr.toNumber(),
    totalAssetsInr: r.totalAssetsInr.toNumber(),
  }));
}

/**
 * Absolute investment P&L over time: value minus what was actually put in, on
 * each recorded day. Unlike net worth, this does not jump when money is added:
 * a top-up or a new holding raises `totalValueInr` and `investedInr` by
 * roughly the same amount in the same instant (new units bought at today's
 * price cost roughly what they're worth today), so the gap between the two
 * barely moves. Only a real change in price moves this line.
 *
 * Reads the same `PortfolioSnapshot` rows `getNetWorthHistory` does, so no
 * schema change or backfill was needed to add this.
 *
 * This is unrealized point-in-time P&L, not a time-weighted or money-weighted
 * return: it says nothing about *when* each rupee went in, only where things
 * stand today versus cost. True XIRR needs cash-flow dates and stays blocked
 * on the `Transaction` model (see TODO.md).
 */
export async function getInvestmentReturnsHistory(
  userId: string,
  days = TREND_MAX_DAYS,
): Promise<ReturnsPoint[]> {
  const since = startOfUtcDay();
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await prisma.portfolioSnapshot.findMany({
    where: { userId, asOf: { gte: since } },
    orderBy: { asOf: "asc" },
  });

  return rows.map((r) => {
    const pnlInr = r.totalValueInr.sub(r.investedInr);
    const pnlPct = r.investedInr.gt(0)
      ? pnlInr.div(r.investedInr).mul(100)
      : new Prisma.Decimal(0);

    return {
      date: r.asOf.toISOString(),
      pnlInr: pnlInr.toNumber(),
      pnlPct: pnlPct.toNumber(),
      investedInr: r.investedInr.toNumber(),
      valueInr: r.totalValueInr.toNumber(),
    };
  });
}
