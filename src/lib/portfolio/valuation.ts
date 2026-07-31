import { Prisma } from "@/generated/prisma";
import type { InstrumentType, Country } from "@/generated/prisma";

// One holding as it arrives from the DB with its instrument and latest cached price.
export type ValuationInput = {
  id: string;
  source: string;
  quantity: Prisma.Decimal;
  avgBuyPrice: Prisma.Decimal;
  instrument: {
    symbol: string;
    name: string;
    type: InstrumentType;
    country: Country;
    currency: string;
  };
  latestPrice: Prisma.Decimal | null;
};

// Serializable, display-ready shape passed to client components (no Decimals
// cross the RSC boundary: they're converted to numbers here).
export type HoldingView = {
  id: string;
  symbol: string;
  name: string;
  type: InstrumentType;
  country: Country;
  currency: string;
  source: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  hasLivePrice: boolean;
  investedInr: number;
  currentValueInr: number;
  pnlInr: number;
  pnlPct: number;
  weightPct: number;
};

export type PortfolioSummary = {
  totalValueInr: number;
  investedInr: number;
  pnlInr: number;
  pnlPct: number;
  holdingsCount: number;
  // Live prices/FX flags: when false, values fall back to cost basis / fallback FX.
  hasLivePrices: boolean;
  fxIsLive: boolean;
};

export type Portfolio = {
  holdings: HoldingView[];
  summary: PortfolioSummary;
};

const ZERO = new Prisma.Decimal(0);
const HUNDRED = new Prisma.Decimal(100);

export function buildPortfolio(
  inputs: ValuationInput[],
  opts: { usdInr: Prisma.Decimal; fxIsLive: boolean },
): Portfolio {
  let anyLivePrice = false;

  // First pass: per-holding INR figures (weights need the grand total first).
  const rows = inputs.map((h) => {
    const hasLivePrice = h.latestPrice !== null;
    if (hasLivePrice) anyLivePrice = true;

    const nativePrice = h.latestPrice ?? h.avgBuyPrice;
    const fxToInr =
      h.instrument.currency === "INR" ? new Prisma.Decimal(1) : opts.usdInr;

    const investedInr = h.quantity.mul(h.avgBuyPrice).mul(fxToInr);
    const currentValueInr = h.quantity.mul(nativePrice).mul(fxToInr);
    const pnlInr = currentValueInr.sub(investedInr);
    const pnlPct = investedInr.gt(ZERO)
      ? pnlInr.div(investedInr).mul(HUNDRED)
      : ZERO;

    return {
      h,
      hasLivePrice,
      nativePrice,
      investedInr,
      currentValueInr,
      pnlInr,
      pnlPct,
    };
  });

  const totalValueInr = rows.reduce((a, r) => a.add(r.currentValueInr), ZERO);
  const totalInvestedInr = rows.reduce((a, r) => a.add(r.investedInr), ZERO);
  const totalPnlInr = totalValueInr.sub(totalInvestedInr);
  const totalPnlPct = totalInvestedInr.gt(ZERO)
    ? totalPnlInr.div(totalInvestedInr).mul(HUNDRED)
    : ZERO;

  const holdings: HoldingView[] = rows.map((r) => ({
    id: r.h.id,
    symbol: r.h.instrument.symbol,
    name: r.h.instrument.name,
    type: r.h.instrument.type,
    country: r.h.instrument.country,
    currency: r.h.instrument.currency,
    source: r.h.source,
    quantity: r.h.quantity.toNumber(),
    avgBuyPrice: r.h.avgBuyPrice.toNumber(),
    currentPrice: r.nativePrice.toNumber(),
    hasLivePrice: r.hasLivePrice,
    investedInr: r.investedInr.toNumber(),
    currentValueInr: r.currentValueInr.toNumber(),
    pnlInr: r.pnlInr.toNumber(),
    pnlPct: r.pnlPct.toNumber(),
    weightPct: totalValueInr.gt(ZERO)
      ? r.currentValueInr.div(totalValueInr).mul(HUNDRED).toNumber()
      : 0,
  }));

  // Largest position first.
  holdings.sort((a, b) => b.currentValueInr - a.currentValueInr);

  return {
    holdings,
    summary: {
      totalValueInr: totalValueInr.toNumber(),
      investedInr: totalInvestedInr.toNumber(),
      pnlInr: totalPnlInr.toNumber(),
      pnlPct: totalPnlPct.toNumber(),
      holdingsCount: inputs.length,
      hasLivePrices: anyLivePrice,
      fxIsLive: opts.fxIsLive,
    },
  };
}
