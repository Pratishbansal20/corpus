import type { Prisma } from "@/generated/prisma";
import type { Instrument } from "@/generated/prisma";

// Re-exported so existing call sites (`@/lib/portfolio/providers/types`)
// don't all need to change import paths for the one thing most of them use.
// The canonical source is `@/lib/http/fetch-retry`, which every provider now
// fetches through.
export { FETCH_HEADERS } from "@/lib/http/fetch-retry";

export type PriceQuote = {
  instrumentId: string;
  price: Prisma.Decimal;
  currency: string;
  asOf: Date;
  source: string;
};

export type FxQuote = {
  base: string;
  quote: string;
  rate: Prisma.Decimal;
  asOf: Date;
  source: string;
};

export interface PriceProvider {
  readonly source: string;
  supports(instrument: Pick<Instrument, "type">): boolean;
  fetchPrices(
    instruments: Instrument[],
  ): Promise<PriceQuote[]>;
}

export interface FxProvider {
  readonly source: string;
  fetchRate(base: string, quote: string): Promise<FxQuote>;
}

/** Truncate to UTC midnight so same-day refreshes upsert instead of duplicating. */
export function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

