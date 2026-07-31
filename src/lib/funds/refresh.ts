import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { GROWW_FUND_SLUGS, fetchGrowwHoldings } from "./groww-provider";

export type FundRefreshResult = {
  updated: string[];
  failed: { symbol: string; error: string }[];
  refreshedAt: Date;
};

function startOfUtcDay(d = new Date()): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Refresh constituents for every held mutual fund that has a Groww mapping.
 *
 * Graceful by design: a fund's holdings are deleted and re-inserted **only after**
 * its fresh scrape succeeds, inside a single transaction. If a fetch fails (Groww
 * down, page changed, nothing parsed), that fund is skipped and its previous
 * holdings remain untouched: the analysis never loses data mid-refresh.
 */
export async function refreshFundHoldings(): Promise<FundRefreshResult> {
  const updated: string[] = [];
  const failed: { symbol: string; error: string }[] = [];
  const asOf = startOfUtcDay();

  const instruments = await prisma.instrument.findMany({
    where: { type: "MUTUAL_FUND", holdings: { some: {} } },
  });

  for (const inst of instruments) {
    const slug = GROWW_FUND_SLUGS[inst.symbol];
    if (!slug) continue; // no mapping: leave any existing data as-is

    try {
      const rows = await fetchGrowwHoldings(slug); // throws on failure/empty
      await prisma.$transaction([
        prisma.fundHolding.deleteMany({ where: { instrumentId: inst.id } }),
        prisma.fundHolding.createMany({
          data: rows.map((r) => ({
            instrumentId: inst.id,
            stock: r.stock,
            sector: r.sector,
            weightPct: new Prisma.Decimal(r.weightPct.toFixed(3)),
            asOf,
            source: "GROWW",
          })),
        }),
      ]);
      updated.push(inst.symbol);
    } catch (e) {
      // Keep previous holdings: do NOT delete anything on failure.
      failed.push({
        symbol: inst.symbol,
        error: e instanceof Error ? e.message : "fetch failed",
      });
    }
  }

  return { updated, failed, refreshedAt: new Date() };
}
