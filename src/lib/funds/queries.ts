import { prisma } from "@/lib/db/prisma";
import {
  companyWeightage,
  sectorWeightage,
  overlapMatrix,
  type FundConstituents,
  type CompanyExposure,
  type SectorExposure,
  type OverlapPair,
} from "./analysis";

export type FundView = {
  instrumentId: string;
  name: string;
  symbol: string;
  valueInr: number;
  constituents: { stock: string; sector: string; weightPct: number }[];
  coveragePct: number; // Σ of disclosed weights: how much of the fund we have data for
  asOf: string | null;
};

export type FundAnalysis = {
  funds: FundView[];
  totalMfValueInr: number;
  fundsWithData: number;
  companies: CompanyExposure[];
  sectors: SectorExposure[];
  overlaps: OverlapPair[];
};

export async function getUserFundAnalysis(userId: string): Promise<FundAnalysis> {
  const mfHoldings = await prisma.holding.findMany({
    where: { userId, instrument: { type: "MUTUAL_FUND" } },
    include: { instrument: true },
  });

  const instrumentIds = [...new Set(mfHoldings.map((h) => h.instrumentId))];

  // Latest price per fund (MFs are INR-denominated).
  const priceRows = instrumentIds.length
    ? await prisma.price.findMany({
        where: { instrumentId: { in: instrumentIds } },
        orderBy: { asOf: "desc" },
      })
    : [];
  const latestPrice = new Map<string, number>();
  for (const p of priceRows) {
    if (!latestPrice.has(p.instrumentId)) latestPrice.set(p.instrumentId, p.price.toNumber());
  }

  // Value per fund (sum across the user's holdings of that fund).
  const valueByInstrument = new Map<string, number>();
  for (const h of mfHoldings) {
    const price = latestPrice.get(h.instrumentId) ?? h.avgBuyPrice.toNumber();
    const v = h.quantity.toNumber() * price;
    valueByInstrument.set(
      h.instrumentId,
      (valueByInstrument.get(h.instrumentId) ?? 0) + v,
    );
  }

  // Latest disclosure's constituents per fund.
  const fhRows = instrumentIds.length
    ? await prisma.fundHolding.findMany({
        where: { instrumentId: { in: instrumentIds } },
        orderBy: { asOf: "desc" },
      })
    : [];
  const latestAsOf = new Map<string, number>(); // instrumentId → max asOf ms
  for (const r of fhRows) {
    const ms = r.asOf.getTime();
    if (!latestAsOf.has(r.instrumentId) || ms > latestAsOf.get(r.instrumentId)!) {
      latestAsOf.set(r.instrumentId, ms);
    }
  }
  const constituentsByFund = new Map<
    string,
    { stock: string; sector: string; weightPct: number }[]
  >();
  for (const r of fhRows) {
    if (r.asOf.getTime() !== latestAsOf.get(r.instrumentId)) continue;
    const list = constituentsByFund.get(r.instrumentId) ?? [];
    list.push({ stock: r.stock, sector: r.sector, weightPct: r.weightPct.toNumber() });
    constituentsByFund.set(r.instrumentId, list);
  }

  // Build per-fund views (unique instruments).
  const seen = new Set<string>();
  const funds: FundView[] = [];
  for (const h of mfHoldings) {
    if (seen.has(h.instrumentId)) continue;
    seen.add(h.instrumentId);
    const constituents = (constituentsByFund.get(h.instrumentId) ?? []).sort(
      (a, b) => b.weightPct - a.weightPct,
    );
    funds.push({
      instrumentId: h.instrumentId,
      name: h.instrument.name,
      symbol: h.instrument.symbol,
      valueInr: valueByInstrument.get(h.instrumentId) ?? 0,
      constituents,
      coveragePct: constituents.reduce((a, c) => a + c.weightPct, 0),
      asOf: latestAsOf.has(h.instrumentId)
        ? new Date(latestAsOf.get(h.instrumentId)!).toISOString()
        : null,
    });
  }
  funds.sort((a, b) => b.valueInr - a.valueInr);

  const totalMfValueInr = funds.reduce((a, f) => a + f.valueInr, 0);

  // Analysis only over funds that actually have constituent data.
  const withData: FundConstituents[] = funds
    .filter((f) => f.constituents.length > 0)
    .map((f) => ({
      instrumentId: f.instrumentId,
      fundName: f.name,
      valueInr: f.valueInr,
      constituents: f.constituents,
    }));

  return {
    funds,
    totalMfValueInr,
    fundsWithData: withData.length,
    companies: companyWeightage(withData),
    sectors: sectorWeightage(withData),
    overlaps: overlapMatrix(withData),
  };
}
