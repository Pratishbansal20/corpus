import { Prisma } from "@/generated/prisma";
import type { Instrument } from "@/generated/prisma";
import {
  FETCH_HEADERS,
  utcDay,
  type PriceProvider,
  type PriceQuote,
} from "./types";

// AMFI's daily NAV dump for every scheme. The previous value here
// (portal.amfiindia.com/spp/navAll.aspx) had been returning 404 since before
// this provider ever ran, so no mutual fund has had a live NAV: every MF price
// in the database was still the seeded placeholder. This URL 302-redirects,
// which fetch follows by default.
const AMFI_NAV_ALL_URL = "https://www.amfiindia.com/spages/NAVAll.txt";

type AmfiRow = {
  schemeCode: string;
  name: string;
  nav: number;
  asOf: Date;
};

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse AMFI's semicolon-delimited NAVAll file into a lookup map. */
export function parseAmfiNavFile(text: string): Map<string, AmfiRow> {
  const byCode = new Map<string, AmfiRow>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim() || line.startsWith("Scheme Code")) continue;
    const parts = line.split(";");
    if (parts.length < 6) continue;

    const schemeCode = parts[0]?.trim();
    const name = parts[3]?.trim();
    const navStr = parts[4]?.trim();
    const dateStr = parts[5]?.trim();
    if (!schemeCode || !name || !navStr || !dateStr) continue;

    const nav = Number(navStr);
    if (!Number.isFinite(nav) || nav <= 0) continue;

    const [dd, mon, yyyy] = dateStr.split("-");
    const months: Record<string, number> = {
      Jan: 0,
      Feb: 1,
      Mar: 2,
      Apr: 3,
      May: 4,
      Jun: 5,
      Jul: 6,
      Aug: 7,
      Sep: 8,
      Oct: 9,
      Nov: 10,
      Dec: 11,
    };
    const month = months[mon ?? ""];
    const year = Number(yyyy);
    const day = Number(dd);
    if (month === undefined || !year || !day) continue;

    byCode.set(schemeCode, {
      schemeCode,
      name,
      nav,
      asOf: new Date(Date.UTC(year, month, day)),
    });
  }

  return byCode;
}

function matchInstrument(
  instrument: Instrument,
  byCode: Map<string, AmfiRow>,
): AmfiRow | undefined {
  if (instrument.externalId) {
    const hit = byCode.get(instrument.externalId);
    if (hit) return hit;
  }

  // Name matching is a fallback only, and deliberately one-directional: the
  // AMFI name must contain ours, never the reverse. Allowing the reverse let a
  // shorter AMFI name swallow a longer holding, which is how "Invesco India
  // Midcap" could be priced with "Invesco India Large & Mid Cap" NAV. Pin
  // externalId to the scheme code to skip this path entirely.
  const target = normalizeName(instrument.name);
  if (!target) return undefined;

  let best: AmfiRow | undefined;
  for (const row of byCode.values()) {
    if (!normalizeName(row.name).includes(target)) continue;
    // Prefer the shortest match: the closest name wins over a longer variant.
    if (!best || row.name.length < best.name.length) best = row;
  }
  return best;
}

export async function fetchAmfiNavMap(): Promise<Map<string, AmfiRow>> {
  const res = await fetch(AMFI_NAV_ALL_URL, {
    headers: FETCH_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`AMFI NAV fetch failed (${res.status})`);
  }
  const text = await res.text();
  const map = parseAmfiNavFile(text);
  if (map.size === 0) {
    throw new Error("AMFI NAV file parsed empty: format may have changed");
  }
  return map;
}

export const amfiNavProvider: PriceProvider = {
  source: "AMFI",

  supports(instrument) {
    return instrument.type === "MUTUAL_FUND";
  },

  async fetchPrices(instruments: Instrument[]): Promise<PriceQuote[]> {
    const mfs = instruments.filter((i) => i.type === "MUTUAL_FUND");
    if (mfs.length === 0) return [];

    const navMap = await fetchAmfiNavMap();
    const quotes: PriceQuote[] = [];

    for (const inst of mfs) {
      const row = matchInstrument(inst, navMap);
      if (!row) continue;
      quotes.push({
        instrumentId: inst.id,
        price: new Prisma.Decimal(String(row.nav)),
        currency: "INR",
        asOf: utcDay(row.asOf),
        source: "AMFI",
      });
    }

    return quotes;
  },
};
