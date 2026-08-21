import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getUsdInrRate } from "@/lib/portfolio/fx";
import { buildPortfolio, type Portfolio } from "@/lib/portfolio/valuation";
import {
  findStalePrices,
  type PricedInstrument,
  type StaleInstrument,
} from "./stale-prices";

/**
 * Held instruments that appear to have stopped pricing.
 *
 * A wrong symbol fails silently: the provider returns null, the refresh counts
 * a skip, and the position quietly keeps showing cost basis as value. Five
 * holdings did exactly that for six weeks. See `stale-prices.ts` for how the
 * judgement is made.
 */
export async function getStalePricedHoldings(
  userId: string,
): Promise<StaleInstrument[]> {
  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: { instrument: true },
  });
  if (holdings.length === 0) return [];

  const instrumentIds = [...new Set(holdings.map((h) => h.instrumentId))];
  const latest = await prisma.price.groupBy({
    by: ["instrumentId"],
    where: { instrumentId: { in: instrumentIds } },
    _max: { asOf: true },
  });
  const lastPriced = new Map(latest.map((r) => [r.instrumentId, r._max.asOf]));

  const seen = new Set<string>();
  const instruments: PricedInstrument[] = [];
  for (const h of holdings) {
    if (seen.has(h.instrumentId)) continue;
    seen.add(h.instrumentId);
    instruments.push({
      instrumentId: h.instrumentId,
      symbol: h.instrument.symbol,
      name: h.instrument.name,
      type: h.instrument.type,
      lastPricedAt: lastPriced.get(h.instrumentId) ?? null,
    });
  }

  return findStalePrices(instruments);
}

// Loads a user's holdings, attaches each instrument's latest price (none yet
// until Milestone 4), and returns the fully-valued portfolio (per-holding views
// + summary). Always scoped by userId: the only entry point the UI uses.
/**
 * Mutual-fund positions whose units have not been touched in `days`.
 *
 * NAVs refresh on their own, but the unit count only changes when the user
 * edits the holding. A lump-sum purchase outside a SIP therefore goes unnoticed
 * until it is entered by hand, which is what this nudge is for.
 */
export async function countStaleMutualFunds(
  userId: string,
  days = 15,
): Promise<number> {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - days);
  return prisma.holding.count({
    where: {
      userId,
      instrument: { type: "MUTUAL_FUND" },
      updatedAt: { lt: threshold },
    },
  });
}

// Wrapped in React's request-scoped `cache()`: the dashboard layout (net
// worth readout, sync label) and a page's own render both call this in the
// same request, and each call rebuilds the whole priced portfolio (holdings
// query, price lookups, an FX rate lookup) from scratch. Before this, one
// navigation to Holdings ran it three times over: once for the layout's
// pricing status, once for its net-worth total, once for the page itself.
// `cache()` collapses repeat calls with the same argument, within one
// request, to the first call's in-flight promise.
export const getUserPortfolio = cache(async function getUserPortfolio(
  userId: string,
): Promise<Portfolio> {
  // The FX rate depends on nothing fetched below, so it's kicked off here
  // rather than awaited after the holdings/price chain: on a Neon connection
  // with real network latency per round trip, that turned 3 sequential
  // round trips into 2 sequential plus 1 in parallel with them.
  const fxPromise = getUsdInrRate();

  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: { instrument: true },
  });

  const instrumentIds = [...new Set(holdings.map((h) => h.instrumentId))];

  // Latest price per instrument (rows are ordered newest-first; first wins).
  const priceRows = instrumentIds.length
    ? await prisma.price.findMany({
        where: { instrumentId: { in: instrumentIds } },
        orderBy: { asOf: "desc" },
      })
    : [];
  const latestPrice = new Map<string, (typeof priceRows)[number]["price"]>();
  for (const p of priceRows) {
    if (!latestPrice.has(p.instrumentId)) {
      latestPrice.set(p.instrumentId, p.price);
    }
  }

  const { rate, isLive } = await fxPromise;

  const inputs = holdings.map((h) => ({
    id: h.id,
    source: h.source,
    quantity: h.quantity,
    avgBuyPrice: h.avgBuyPrice,
    instrument: {
      symbol: h.instrument.symbol,
      name: h.instrument.name,
      type: h.instrument.type,
      country: h.instrument.country,
      currency: h.instrument.currency,
    },
    latestPrice: latestPrice.get(h.instrumentId) ?? null,
  }));

  return buildPortfolio(inputs, { usdInr: rate, fxIsLive: isLive });
});
