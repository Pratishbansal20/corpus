import { prisma } from "@/lib/db/prisma";
import { computeXirr, isTrustworthyDateSource } from "@/lib/portfolio/xirr";
import { getCachedNavHistory } from "@/lib/portfolio/providers/mfapi-nav-history";
import {
  buildFundWindowFlows,
  computeFundXirrForWindow,
  FUND_XIRR_WINDOWS,
  type FundXirrTransaction,
  type FundXirrWindow,
} from "./xirr-window";
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
  // A rate per toggleable window ("1M", "3M", ... "ALL" for since-inception).
  // null for a given window when there's no dated purchase history to
  // compute a rate from at all, any of it is untrustworthy (a hand-typed
  // entry, an opening-balance stub), or - for a window shorter than "ALL" -
  // the fund's own published NAV history doesn't reach back far enough to
  // price a position that already existed at the window's start. Never a
  // fabricated-looking number either way.
  xirrByWindow: Record<FundXirrWindow, number | null>;
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
  // Combined XIRR per window, across every fund whose own XIRR for that
  // window could be computed. Not "the portfolio's mutual-fund XIRR"
  // outright when some funds are excluded - fundsWithXirrByWindow says how
  // many actually went in, per window (a fund missing from a 6M figure can
  // still be present in the ALL one).
  totalMfXirrByWindow: Record<FundXirrWindow, number | null>;
  fundsWithXirrByWindow: Record<FundXirrWindow, number>;
  xirrWindows: FundXirrWindow[];
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
  const transactionsByInstrument = new Map<string, FundXirrTransaction[]>();
  const untrustworthyInstruments = new Set<string>();
  for (const t of mfTransactions) {
    if (!isTrustworthyDateSource(t.source)) {
      untrustworthyInstruments.add(t.instrumentId);
      continue;
    }
    const list = transactionsByInstrument.get(t.instrumentId) ?? [];
    list.push({
      date: t.date,
      type: t.type,
      quantity: t.quantity.toNumber(),
      amount: t.amount.toNumber(),
    });
    transactionsByInstrument.set(t.instrumentId, list);
  }

  // Only the windowed figures (everything but "ALL") need a fund's full NAV
  // history, to price a pre-existing position at the window's start. Fetched
  // once per fund (cached across requests - see getCachedNavHistory), in
  // parallel, only for funds that have an AMFI scheme code at all (the same
  // NO_SCHEME_CODE gate SIP auto-apply already uses) and aren't already
  // excluded for having an untrustworthy transaction date.
  const navHistoryByInstrument = new Map<
    string,
    Awaited<ReturnType<typeof getCachedNavHistory>>
  >();
  await Promise.all(
    mfHoldings
      .filter(
        (h) =>
          !untrustworthyInstruments.has(h.instrumentId) &&
          h.instrument.externalId &&
          !navHistoryByInstrument.has(h.instrumentId),
      )
      .map(async (h) => {
        navHistoryByInstrument.set(
          h.instrumentId,
          await getCachedNavHistory(h.instrument.externalId!),
        );
      }),
  );

  const today = new Date();
  function xirrByWindowForInstrument(
    instrumentId: string,
  ): Record<FundXirrWindow, number | null> {
    const result = {} as Record<FundXirrWindow, number | null>;
    if (untrustworthyInstruments.has(instrumentId)) {
      for (const w of FUND_XIRR_WINDOWS) result[w] = null;
      return result;
    }
    const transactions = transactionsByInstrument.get(instrumentId) ?? [];
    const navHistory = navHistoryByInstrument.get(instrumentId) ?? null;
    const currentValueInr = valueByInstrument.get(instrumentId) ?? 0;
    for (const w of FUND_XIRR_WINDOWS) {
      const rate = computeFundXirrForWindow(
        transactions,
        navHistory,
        currentValueInr,
        w,
        today,
      );
      result[w] = rate === null ? null : rate * 100;
    }
    return result;
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
      xirrByWindow: xirrByWindowForInstrument(h.instrumentId),
    });
  }
  funds.sort((a, b) => b.valueInr - a.valueInr);

  // Combined XIRR per window, across every fund whose own flows for that
  // window could be built - reuses buildFundWindowFlows rather than
  // recomputing, so "combined" can never silently disagree with the
  // per-fund figures it's made of.
  const eligibleInstrumentIds = [...transactionsByInstrument.keys()].filter(
    (id) => !untrustworthyInstruments.has(id),
  );
  const totalMfXirrByWindow = {} as Record<FundXirrWindow, number | null>;
  const fundsWithXirrByWindow = {} as Record<FundXirrWindow, number>;
  for (const w of FUND_XIRR_WINDOWS) {
    const perFundFlows = eligibleInstrumentIds
      .map((id) =>
        buildFundWindowFlows(
          transactionsByInstrument.get(id) ?? [],
          navHistoryByInstrument.get(id) ?? null,
          valueByInstrument.get(id) ?? 0,
          w,
          today,
        ),
      )
      .filter((flows): flows is NonNullable<typeof flows> => flows !== null);
    const rate = computeXirr(perFundFlows.flat());
    totalMfXirrByWindow[w] = rate === null ? null : rate * 100;
    fundsWithXirrByWindow[w] = perFundFlows.length;
  }

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
    totalMfXirrByWindow,
    fundsWithXirrByWindow,
    xirrWindows: FUND_XIRR_WINDOWS,
  };
}
