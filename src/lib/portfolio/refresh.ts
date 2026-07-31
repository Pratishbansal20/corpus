import { prisma } from "@/lib/db/prisma";
import { amfiNavProvider } from "./providers/amfi-nav";
import { frankfurterFxProvider } from "./providers/frankfurter-fx";
import { yahooEquityProvider } from "./providers/yahoo-equity";
import type { FxQuote, PriceQuote } from "./providers/types";

export type RefreshResult = {
  ok: boolean;
  pricesUpdated: number;
  pricesSkipped: number;
  pricesFailed: number;
  fxUpdated: boolean;
  fxFailed: boolean;
  errors: string[];
  refreshedAt: Date;
};

const priceProviders = [amfiNavProvider, yahooEquityProvider];

async function upsertPrice(quote: PriceQuote): Promise<void> {
  await prisma.price.upsert({
    where: {
      instrumentId_asOf: {
        instrumentId: quote.instrumentId,
        asOf: quote.asOf,
      },
    },
    update: {
      price: quote.price,
      currency: quote.currency,
      source: quote.source,
    },
    create: {
      instrumentId: quote.instrumentId,
      price: quote.price,
      currency: quote.currency,
      asOf: quote.asOf,
      source: quote.source,
    },
  });
}

async function upsertFx(quote: FxQuote): Promise<void> {
  await prisma.fxRate.upsert({
    where: {
      base_quote_asOf: {
        base: quote.base,
        quote: quote.quote,
        asOf: quote.asOf,
      },
    },
    update: {
      rate: quote.rate,
      source: quote.source,
    },
    create: {
      base: quote.base,
      quote: quote.quote,
      rate: quote.rate,
      asOf: quote.asOf,
      source: quote.source,
    },
  });
}

/**
 * Fetch live prices for all held instruments + USD/INR, persist to DB cache.
 * Failures are collected: existing cached prices are never deleted.
 */
export async function refreshPortfolioPrices(): Promise<RefreshResult> {
  const errors: string[] = [];
  let pricesUpdated = 0;
  let pricesFailed = 0;
  let fxUpdated = false;
  let fxFailed = false;

  // FX first (US holdings need it).
  try {
    const fx = await frankfurterFxProvider.fetchRate("USD", "INR");
    await upsertFx(fx);
    fxUpdated = true;
  } catch (e) {
    fxFailed = true;
    errors.push(e instanceof Error ? e.message : "FX refresh failed");
  }

  const instruments = await prisma.instrument.findMany({
    where: { holdings: { some: {} } },
  });

  if (instruments.length === 0) {
    return {
      ok: errors.length === 0,
      pricesUpdated: 0,
      pricesSkipped: 0,
      pricesFailed: 0,
      fxUpdated,
      fxFailed,
      errors,
      refreshedAt: new Date(),
    };
  }

  const updatedIds = new Set<string>();

  for (const provider of priceProviders) {
    const batch = instruments.filter((i) => provider.supports(i));
    if (batch.length === 0) continue;

    try {
      const quotes = await provider.fetchPrices(batch);
      for (const q of quotes) {
        await upsertPrice(q);
        updatedIds.add(q.instrumentId);
      }
    } catch (e) {
      pricesFailed += batch.length;
      errors.push(
        `${provider.source}: ${e instanceof Error ? e.message : "fetch failed"}`,
      );
    }
  }

  pricesUpdated = updatedIds.size;
  const pricesSkipped = instruments.length - updatedIds.size;
  pricesFailed = Math.max(0, pricesFailed - pricesUpdated);

  return {
    ok: errors.length === 0 || pricesUpdated > 0 || fxUpdated,
    pricesUpdated,
    pricesSkipped,
    pricesFailed,
    fxUpdated,
    fxFailed,
    errors,
    refreshedAt: new Date(),
  };
}
