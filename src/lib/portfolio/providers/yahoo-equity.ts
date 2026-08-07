import { Prisma } from "@/generated/prisma";
import type { Instrument } from "@/generated/prisma";
import {
  FETCH_HEADERS,
  utcDay,
  type PriceProvider,
  type PriceQuote,
} from "./types";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

/**
 * The Yahoo symbols to try, in order of preference.
 *
 * Indian stocks were only ever tried on NSE. Anything listed solely on BSE
 * (plenty of small caps: Ventura Textiles is one) therefore 404'd on every
 * refresh and silently kept its seeded price forever. NSE stays first because
 * it is the more liquid quote when a stock is on both.
 */
function yahooSymbols(instrument: Instrument): string[] {
  if (instrument.type === "IN_STOCK") {
    return [`${instrument.symbol}.NS`, `${instrument.symbol}.BO`];
  }
  return [instrument.symbol];
}

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        currency?: string;
        regularMarketTime?: number;
      };
    }>;
  };
};

async function quoteFor(
  instrument: Instrument,
  symbol: string,
): Promise<PriceQuote | null> {
  const url = `${YAHOO_CHART}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  const res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as YahooChartResponse;
  const meta = json.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  if (
    !meta ||
    price === undefined ||
    !Number.isFinite(price) ||
    price <= 0
  ) {
    return null;
  }

  const asOf = meta.regularMarketTime
    ? utcDay(new Date(meta.regularMarketTime * 1000))
    : utcDay(new Date());

  return {
    instrumentId: instrument.id,
    price: new Prisma.Decimal(String(price)),
    currency: meta.currency ?? instrument.currency,
    asOf,
    source: "YAHOO",
  };
}

export async function fetchYahooPrice(
  instrument: Instrument,
): Promise<PriceQuote | null> {
  // First listing that answers wins. A 404 on NSE is not "no price", it is
  // "not listed there", so a BSE-only stock still gets valued.
  for (const symbol of yahooSymbols(instrument)) {
    const quote = await quoteFor(instrument, symbol);
    if (quote) return quote;
  }
  return null;
}

export const yahooEquityProvider: PriceProvider = {
  source: "YAHOO",

  supports(instrument) {
    return instrument.type === "IN_STOCK" || instrument.type === "US_STOCK";
  },

  async fetchPrices(instruments: Instrument[]): Promise<PriceQuote[]> {
    const stocks = instruments.filter(
      (i) => i.type === "IN_STOCK" || i.type === "US_STOCK",
    );
    if (stocks.length === 0) return [];

    // Sequential fetches: Yahoo rate-limits aggressive parallel bursts.
    const quotes: PriceQuote[] = [];
    for (const inst of stocks) {
      try {
        const quote = await fetchYahooPrice(inst);
        if (quote) quotes.push(quote);
      } catch {
        // Skip failed symbol; refresh stats will count it as skipped.
      }
    }
    return quotes;
  },
};
