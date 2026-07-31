// Mutual-fund constituent holdings, scraped from Groww's page-embedded portfolio
// JSON (each holding carries company_name, nature_name, sector_name, corpus_per).
// There is no official free API for Indian MF constituents, so this is an
// unofficial source: fine for low-volume personal use, but it can break if Groww
// changes their page: callers must degrade gracefully (keep last-good data).

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

// Pinned instrument-symbol → Groww slug. Pinned (not searched) so we never grab
// the wrong fund (e.g. a momentum-index variant). Some slugs keep the fund's old
// name (HDFC "equity", Motilal "midcap-30"): that's Groww's canonical slug.
export const GROWW_FUND_SLUGS: Record<string, string> = {
  HDFC_FLEXI: "hdfc-equity-fund-direct-growth",
  NIPPON_SMALL: "nippon-india-small-cap-fund-direct-growth",
  MOTILAL_MID: "motilal-oswal-most-focused-midcap-30-fund-direct-growth",
  INVESCO_MID: "invesco-india-mid-cap-fund-direct-growth",
  ICICI_PHARMA:
    "icici-prudential-pharma-healthcare-and-diagnostics-(p.h.d)-fund-direct-growth",
  BANDHAN_SMALL: "bandhan-small-cap-fund-direct-growth",
  JIOBR_FLEXI: "jioblackrock-flexi-cap-fund-direct-growth",
};

export type ScrapedHolding = {
  stock: string;
  sector: string;
  weightPct: number;
};

function decode(s: string): string {
  return s
    .replace(/\\u0026/g, "&")
    .replace(/\\u0027/g, "'")
    .replace(/\s+Ltd\.?$/, "")
    .trim();
}

// Pull equity constituents (drops cash / repo / debt via nature_name) with weights.
export function parseGrowwHoldings(html: string): ScrapedHolding[] {
  const re =
    /"company_name":"([^"]+)","nature_name":"([^"]+)","sector_name":"([^"]*)"[^}]*?"corpus_per":([0-9.]+)/g;
  const out: ScrapedHolding[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[2] !== "EQUITY") continue;
    const w = parseFloat(m[4]);
    if (!(w > 0)) continue;
    out.push({
      stock: decode(m[1]),
      sector: (m[3] || "Unknown").replace(/\\u0026/g, "&"),
      weightPct: w,
    });
  }
  return out;
}

// Throws on HTTP error or if nothing parsed: so the caller keeps existing data.
export async function fetchGrowwHoldings(
  slug: string,
): Promise<ScrapedHolding[]> {
  const res = await fetch(`https://groww.in/mutual-funds/${slug}`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Groww HTTP ${res.status}`);
  const html = await res.text();
  const rows = parseGrowwHoldings(html);
  if (rows.length === 0) throw new Error("no holdings parsed");
  return rows;
}
