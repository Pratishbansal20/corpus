import { prisma } from "@/lib/db/prisma";
import { getUsdInrRate } from "@/lib/portfolio/fx";
import { buildPortfolio, type Portfolio } from "@/lib/portfolio/valuation";

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

export async function getUserPortfolio(userId: string): Promise<Portfolio> {
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

  const { rate, isLive } = await getUsdInrRate();

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
}
