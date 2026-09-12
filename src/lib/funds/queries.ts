import { prisma } from "@/lib/db/prisma";
import { computeXirr, isTrustworthyDateSource, type CashFlow } from "@/lib/portfolio/xirr";
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
  investedInr: number;
  returnsInr: number;
  returnsPct: number;
  constituents: { stock: string; sector: string; weightPct: number }[];
  coveragePct: number; // Σ of disclosed weights: how much of the fund we have data for
  asOf: string | null;
  // null when this fund has no dated purchase history to compute a rate
  // from, or any of it is untrustworthy (a hand-typed entry, an
  // opening-balance stub) - never a fabricated-looking number.
  xirrPct: number | null;
};

export type FundAnalysis = {
  funds: FundView[];
  totalMfValueInr: number;
  totalMfInvestedInr: number;
  totalReturnsInr: number;
  totalReturnsPct: number;
  fundsWithData: number;
  companies: CompanyExposure[];
  sectors: SectorExposure[];
  overlaps: OverlapPair[];
  // Combined XIRR across every fund whose own XIRR could be computed. Not
  // "the portfolio's mutual-fund XIRR" outright when some funds are
  // excluded - fundsWithXirr says how many actually went in.
  totalMfXirrPct: number | null;
  fundsWithXirr: number;
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

  // Value and cost basis per fund (summed across the user's holdings of it).
  const valueByInstrument = new Map<string, number>();
  const investedByInstrument = new Map<string, number>();
  for (const h of mfHoldings) {
    const price = latestPrice.get(h.instrumentId) ?? h.avgBuyPrice.toNumber();
    const qty = h.quantity.toNumber();
    valueByInstrument.set(
      h.instrumentId,
      (valueByInstrument.get(h.instrumentId) ?? 0) + qty * price,
    );
    investedByInstrument.set(
      h.instrumentId,
      (investedByInstrument.get(h.instrumentId) ?? 0) +
        qty * h.avgBuyPrice.toNumber(),
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

  // XIRR: real dated cash flows only, mutual funds only (see
  // lib/portfolio/xirr.ts - the algorithm is general, this app just doesn't
  // trust equity holdings' dates yet, all of which currently trace back to a
  // single fabricated-date opening-balance stub, not a real purchase date).
  // Grouped by instrumentId, not by individual holding: a fund's Transaction
  // rows sum across however many Holdings actually hold it, the same way its
  // value and cost basis already do above.
  const holdingIds = mfHoldings.map((h) => h.id);
  const mfTransactions = holdingIds.length
    ? await prisma.transaction.findMany({
        where: { holdingId: { in: holdingIds } },
        orderBy: { date: "asc" },
      })
    : [];
  const cashFlowsByInstrument = new Map<string, CashFlow[]>();
  const untrustworthyInstruments = new Set<string>();
  for (const t of mfTransactions) {
    if (!isTrustworthyDateSource(t.source)) {
      untrustworthyInstruments.add(t.instrumentId);
      continue;
    }
    const signedAmount =
      t.type === "BUY" ? -t.amount.toNumber() : t.amount.toNumber();
    const list = cashFlowsByInstrument.get(t.instrumentId) ?? [];
    list.push({ date: t.date, amount: signedAmount });
    cashFlowsByInstrument.set(t.instrumentId, list);
  }

  const today = new Date();
  function xirrForInstrument(instrumentId: string): number | null {
    if (untrustworthyInstruments.has(instrumentId)) return null;
    const flows = cashFlowsByInstrument.get(instrumentId);
    if (!flows || flows.length === 0) return null;
    const withCurrentValue: CashFlow[] = [
      ...flows,
      { date: today, amount: valueByInstrument.get(instrumentId) ?? 0 },
    ];
    const rate = computeXirr(withCurrentValue);
    return rate === null ? null : rate * 100;
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
    const valueInr = valueByInstrument.get(h.instrumentId) ?? 0;
    const investedInr = investedByInstrument.get(h.instrumentId) ?? 0;
    funds.push({
      instrumentId: h.instrumentId,
      name: h.instrument.name,
      symbol: h.instrument.symbol,
      valueInr,
      investedInr,
      returnsInr: valueInr - investedInr,
      returnsPct:
        investedInr > 0 ? ((valueInr - investedInr) / investedInr) * 100 : 0,
      constituents,
      coveragePct: constituents.reduce((a, c) => a + c.weightPct, 0),
      asOf: latestAsOf.has(h.instrumentId)
        ? new Date(latestAsOf.get(h.instrumentId)!).toISOString()
        : null,
      xirrPct: xirrForInstrument(h.instrumentId),
    });
  }
  funds.sort((a, b) => b.valueInr - a.valueInr);

  // Combined XIRR across every fund whose own XIRR was computable - each
  // fund's flows already carry its own current-value flow, so concatenating
  // them is enough; XIRR doesn't care how many distinct flows share a date.
  const eligibleInstrumentIds = [...cashFlowsByInstrument.keys()].filter(
    (id) => !untrustworthyInstruments.has(id),
  );
  const combinedFlows = eligibleInstrumentIds.flatMap((id) => [
    ...cashFlowsByInstrument.get(id)!,
    { date: today, amount: valueByInstrument.get(id) ?? 0 },
  ]);
  const totalMfXirr = computeXirr(combinedFlows);

  const totalMfValueInr = funds.reduce((a, f) => a + f.valueInr, 0);
  const totalMfInvestedInr = funds.reduce((a, f) => a + f.investedInr, 0);
  const totalReturnsInr = totalMfValueInr - totalMfInvestedInr;

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
    totalMfInvestedInr,
    totalReturnsInr,
    totalReturnsPct:
      totalMfInvestedInr > 0 ? (totalReturnsInr / totalMfInvestedInr) * 100 : 0,
    fundsWithData: withData.length,
    companies: companyWeightage(withData),
    sectors: sectorWeightage(withData),
    overlaps: overlapMatrix(withData),
    totalMfXirrPct: totalMfXirr === null ? null : totalMfXirr * 100,
    fundsWithXirr: eligibleInstrumentIds.length,
  };
}
