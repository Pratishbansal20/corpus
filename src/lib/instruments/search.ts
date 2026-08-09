import type { InstrumentType } from "@/generated/prisma";
import { fetchOkWithRetry } from "@/lib/http/fetch-retry";

/**
 * Searching for something to buy, by name.
 *
 * Adding a holding used to require knowing the exact ticker, the exact fund
 * name and, for a mutual fund, the AMFI scheme code looked up by hand. Getting
 * any of them wrong meant the position silently never priced. Searching by name
 * and filling all of it in removes the whole class of mistake.
 *
 * Two sources, because no single one covers both:
 *   mfapi.in  every AMFI scheme, and it returns the scheme code, which is
 *             exactly the externalId the NAV provider matches on
 *   Yahoo     Indian and US equities
 */

export type InstrumentHit = {
  type: InstrumentType;
  symbol: string;
  name: string;
  /** AMFI scheme code for funds: what makes NAV pricing exact. */
  externalId?: string;
  /** Where it trades, shown to disambiguate lookalike results. */
  hint?: string;
};

const MFAPI_SEARCH = "https://api.mfapi.in/mf/search";
const YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search";

/**
 * Exchanges whose symbols the price pipeline can actually quote.
 *
 * Indian stocks are priced by trying `.NS` then `.BO`, so both NSE and BSE
 * listings are offered. US symbols are queried bare. Anything else (a London
 * or Frankfurt cross listing, a Brazilian DRN) is dropped rather than offered
 * as a trap, because nothing would ever price it.
 */
const US_EXCHANGES = new Set(["NMS", "NYQ", "NGM", "NCM", "PCX", "ASE", "BTS"]);

type MfapiRow = { schemeCode?: unknown; schemeName?: unknown };

export function parseMfapiSearch(payload: unknown, limit = 8): InstrumentHit[] {
  if (!Array.isArray(payload)) return [];

  const hits: InstrumentHit[] = [];
  for (const row of payload as MfapiRow[]) {
    if (!row || typeof row !== "object") continue;
    const code = row.schemeCode;
    const name = row.schemeName;
    if (typeof name !== "string" || !name.trim()) continue;
    if (typeof code !== "number" && typeof code !== "string") continue;

    hits.push({
      type: "MUTUAL_FUND",
      // Funds have no ticker, so the scheme code doubles as a stable unique
      // symbol. Deriving one from the name would collide across plan variants.
      symbol: `MF${code}`,
      name: name.trim(),
      externalId: String(code),
      hint: planHint(name),
    });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** "Direct Growth" and friends, so the plan variant is pickable at a glance. */
function planHint(name: string): string | undefined {
  const plan = /\bdirect\b/i.test(name)
    ? "Direct"
    : /\bregular\b/i.test(name)
      ? "Regular"
      : undefined;
  const option = /\bidcw\b|\bdividend\b/i.test(name)
    ? "IDCW"
    : /\bgrowth\b/i.test(name)
      ? "Growth"
      : undefined;
  return [plan, option].filter(Boolean).join(" ") || undefined;
}

type YahooQuote = {
  symbol?: unknown;
  exchange?: unknown;
  quoteType?: unknown;
  shortname?: unknown;
  longname?: unknown;
};

export function parseYahooSearch(payload: unknown, limit = 8): InstrumentHit[] {
  const quotes =
    payload && typeof payload === "object" && "quotes" in payload
      ? (payload as { quotes: unknown }).quotes
      : null;
  if (!Array.isArray(quotes)) return [];

  const hits: InstrumentHit[] = [];
  for (const q of quotes as YahooQuote[]) {
    if (!q || typeof q !== "object") continue;
    const symbol = typeof q.symbol === "string" ? q.symbol : "";
    const exchange = typeof q.exchange === "string" ? q.exchange : "";
    const quoteType = typeof q.quoteType === "string" ? q.quoteType : "";
    const name =
      (typeof q.longname === "string" && q.longname) ||
      (typeof q.shortname === "string" && q.shortname) ||
      symbol;
    if (!symbol || (quoteType !== "EQUITY" && quoteType !== "ETF")) continue;

    if (symbol.endsWith(".NS") || symbol.endsWith(".BO")) {
      // Both map to the same stored symbol, because pricing tries NSE then BSE
      // off the bare ticker. dedupe() below keeps whichever came first, and
      // NSE is ranked ahead so a dual-listed stock reads as the NSE quote.
      hits.push({
        type: "IN_STOCK",
        symbol: symbol.slice(0, -3),
        name: titleish(name),
        hint: symbol.endsWith(".NS") ? "NSE" : "BSE",
      });
    } else if (!symbol.includes(".") && US_EXCHANGES.has(exchange)) {
      hits.push({
        type: "US_STOCK",
        symbol,
        name: titleish(name),
        hint: exchange === "NYQ" ? "NYSE" : "NASDAQ",
      });
    }
    if (hits.length >= limit) break;
  }
  // Stable sort putting NSE ahead of BSE. Yahoo often lists the BSE line first,
  // and since both collapse to one stored symbol, the row that survives dedupe
  // should be labelled with the exchange the price will actually come from.
  return hits
    .map((hit, i) => ({ hit, i }))
    .sort((a, b) => rankHint(a.hit.hint) - rankHint(b.hit.hint) || a.i - b.i)
    .map((x) => x.hit);
}

function rankHint(hint: string | undefined): number {
  return hint === "BSE" ? 1 : 0;
}

/** Yahoo shouts some names ("INFOSYS LIMITED"); soften all-caps for display. */
function titleish(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bLtd\b/g, "Ltd");
}

/**
 * The first outbound request from a cold server process pays a DNS and TLS
 * handshake that has been measured at 8 to 9 seconds here, while every request
 * after it lands in well under a second. An 8s budget with no retry therefore
 * failed the *first* search of a session every time and returned "nothing
 * found" for a fund that plainly exists. One retry on a generous budget covers
 * the cold start without making a genuine miss feel slow.
 */
const SEARCH_TIMEOUT_MS = 12_000;
const SEARCH_ATTEMPTS = 2;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetchOkWithRetry(url, {
    attempts: SEARCH_ATTEMPTS,
    timeoutMs: SEARCH_TIMEOUT_MS,
  });
  return res.json();
}

/**
 * Search both sources at once and merge.
 *
 * Each source is allowed to fail on its own: a Yahoo outage should still let
 * funds be found, and vice versa. Returning half the results beats an error
 * that blocks adding a holding entirely.
 */
export async function searchInstruments(
  query: string,
  perSource = 8,
): Promise<InstrumentHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const [funds, equities] = await Promise.all([
    fetchJson(`${MFAPI_SEARCH}?q=${encodeURIComponent(q)}`)
      .then((j) => parseMfapiSearch(j, perSource))
      .catch(() => [] as InstrumentHit[]),
    fetchJson(
      `${YAHOO_SEARCH}?q=${encodeURIComponent(q)}&quotesCount=${perSource * 2}&newsCount=0`,
    )
      .then((j) => parseYahooSearch(j, perSource))
      .catch(() => [] as InstrumentHit[]),
  ]);

  return dedupe([...equities, ...funds]);
}

/** One row per (type, symbol): the same key the Instrument table is unique on. */
export function dedupe(hits: InstrumentHit[]): InstrumentHit[] {
  const seen = new Set<string>();
  const out: InstrumentHit[] = [];
  for (const h of hits) {
    const key = `${h.type}|${h.symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}
