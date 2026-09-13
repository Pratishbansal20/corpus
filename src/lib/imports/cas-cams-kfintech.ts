// Parser for a CAMS/KFintech Consolidated Account Statement (CAS) — the
// document every AMC-agnostic mutual-fund holding shows up on. Pure text in,
// structured rows out: no Prisma import, so it's testable without a database,
// same as every other pure logic module in this app.
//
// The layout is rigidly tabular (a fixed statement format both RTAs share),
// which is why this is a real parser rather than the LLM-extraction path
// TODO.md scopes for a broker's own, inconsistently-laid-out holdings export.
//
// Real gaps confirmed against an actual downloaded CAS (see TODO.md's "PDF /
// LLM holdings import" note), all handled here:
//   1. Identity is ISIN + a folio number, never the AMFI scheme code this app
//      otherwise keys on - resolution against Instrument is the caller's job.
//   2. Real noise: "*** Stamp Duty ***" (a fee, no units), "***Cancelled***"
//      and "***Address Updated...***" (pure noise) - all skipped here.
//   3. A single fund routinely spans 2-3 folios (different distributor code
//      and/or demat vs. non-demat) - every real folio is kept, never merged;
//      whether they roll up into one Holding is the caller's decision.

/** One real purchase/sale/dividend line, still tied to its source folio. */
export type CasTransactionRow = {
  isin: string;
  fundName: string; // AMC + scheme name, as CAS spells it (before " - Direct...")
  planLabel: string; // e.g. "Direct Plan-Growth (Non-Demat)"
  folio: string;
  date: string; // YYYY-MM-DD
  description: string; // raw transaction text, kept for audit/notes
  amount: number; // native currency (always INR for a CAS)
  units: number;
  price: number;
  // The running post-transaction unit balance CAS prints as the line's last
  // column. Not meaningful on its own, but it's what makes lineRef unique: a
  // registrar can and does print two genuinely separate purchases on the
  // same day with identical description and amount (confirmed against a
  // real statement - two SIP instalments processed together), distinguished
  // only by this running total moving twice.
  unitBalance: number;
  /** A stable key for import idempotency: folio + date + description + amount + running balance. */
  lineRef: string;
};

export type CasFolioSummary = {
  isin: string;
  fundName: string;
  planLabel: string;
  folio: string;
  closingUnits: number;
  totalCostValue: number;
};

export type CasParseResult = {
  transactions: CasTransactionRow[];
  folios: CasFolioSummary[];
  /** Lines that looked like a transaction row but didn't fully parse - surfaced, never silently dropped. */
  unparsed: string[];
};

// Every noise marker is itself a transaction-shaped line: it carries the same
// leading "DD-Mon-YYYY" date as a real purchase (and, for Stamp Duty, a
// trailing amount too), which is why each pattern allows for both rather
// than anchoring on the "***" alone.
const DATE_PREFIX = /^(?:\d{2}-[A-Za-z]{3}-\d{4}\s+)?/.source;
const NOISE_PATTERNS = [
  new RegExp(`${DATE_PREFIX}\\*{3,}\\s*Stamp Duty\\s*\\*{3,}\\s*[\\d,.]*$`, "i"),
  new RegExp(`${DATE_PREFIX}\\*{3,}\\s*Cancelled\\s*\\*{3,}$`, "i"),
  new RegExp(`${DATE_PREFIX}\\*{3,}\\s*Address Updated.*\\*{3,}$`, "i"),
];
// The statement's own cover-page date range, e.g. "01-Jan-2004 To
// 11-Sep-2026" - shaped just enough like a transaction line (starts with a
// date) to otherwise trip the catch-all below.
const DATE_RANGE_HEADER_RE =
  /^\d{2}-[A-Za-z]{3}-\d{4}\s+To\s+\d{2}-[A-Za-z]{3}-\d{4}$/;

// "GD340-Bandhan Small Cap Fund-Direct Plan-Growth (Non-Demat) - ISIN: INF194KB1AL4(Advisor: INZ000240532) Registrar : CAMS"
// The scheme code prefix (GD340) and the registrar/advisor suffix vary in
// shape across AMCs (CAMS vs KFintech), so this matches only the two anchors
// that are always present: the ISIN and, before it, "<name> - ISIN:".
const SCHEME_HEADER_RE =
  /^(?:[A-Z0-9]+-)?(.+?)\s*-\s*ISIN:\s*([A-Z0-9]{12})/;

const FOLIO_RE = /^Folio No:\s*([^\s]+(?:\s*\/\s*\d+)?)/;

// "Closing Unit Balance: 109.624 Total Cost Value: 5,500.00" - the NAV/market
// value that follows it in the statement is its own separate line above this
// one, not part of it, so this only needs the two figures that matter here.
const CLOSING_BALANCE_RE =
  /^Closing Unit Balance:\s*([\d,]+\.\d+)\s+Total Cost Value:\s*([\d,]+\.\d+)/;

// "19-May-2025 Net Systematic Purchase-BSE - Instalment No - 1 via Online 249.99 5.152 48.523 5.152"
// Four trailing numbers: amount, units, price, running unit balance. The
// description is everything between the date and those four numbers, and it
// varies wildly across AMCs/registrars, so it is captured as free text
// rather than matched against a fixed vocabulary.
const TXN_LINE_RE =
  /^(\d{2}-[A-Za-z]{3}-\d{4})\s+(.+?)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)$/;

const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

/** "19-May-2025" -> "2025-05-19". Never local-midnight: the caller builds the UTC Date. */
function toIsoDate(d: string): string | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(d);
  if (!m) return null;
  const month = MONTHS[m[2]];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1]}`;
}

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ""));
}

/**
 * Parse a CAS's extracted text into transactions + per-folio summaries.
 *
 * Deliberately tolerant: an AMC/registrar-specific line shape that doesn't
 * match the transaction pattern is reported in `unparsed` rather than thrown
 * on, since a CAS mixes several registrars (CAMS, KFintech) with slightly
 * different wording, and this app's own contract everywhere else is "degrade
 * and report, never crash on one bad row."
 */
export function parseCasStatement(text: string): CasParseResult {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const transactions: CasTransactionRow[] = [];
  const folios: CasFolioSummary[] = [];
  const unparsed: string[] = [];

  let currentIsin: string | null = null;
  let currentFundName: string | null = null;
  let currentPlanLabel: string | null = null;
  let currentFolio: string | null = null;

  for (const line of lines) {
    if (NOISE_PATTERNS.some((re) => re.test(line))) continue;

    const header = SCHEME_HEADER_RE.exec(line);
    if (header) {
      const [, fullName, isin] = header;
      // fullName is "<AMC + scheme> - <plan label>", e.g.
      // "Bandhan Small Cap Fund-Direct Plan-Growth (Non-Demat)". Split on the
      // last " - " that precedes the plan/option wording isn't reliable
      // across AMCs, so the whole pre-ISIN string is kept as fundName and the
      // plan label is left for the caller to ignore or refine; what matters
      // for resolution is the ISIN, not this free text.
      currentIsin = isin;
      currentFundName = fullName.trim();
      currentPlanLabel = null;
      currentFolio = null;
      continue;
    }

    const folioMatch = FOLIO_RE.exec(line);
    if (folioMatch) {
      currentFolio = folioMatch[1].trim();
      continue;
    }

    const closing = CLOSING_BALANCE_RE.exec(line);
    if (closing && currentIsin && currentFundName && currentFolio) {
      folios.push({
        isin: currentIsin,
        fundName: currentFundName,
        planLabel: currentPlanLabel ?? "",
        folio: currentFolio,
        closingUnits: toNumber(closing[1]),
        totalCostValue: toNumber(closing[2]),
      });
      continue;
    }

    const txn = TXN_LINE_RE.exec(line);
    if (txn) {
      if (!currentIsin || !currentFundName || !currentFolio) {
        unparsed.push(line);
        continue;
      }
      const [, date, description, amount, units, price, unitBalance] = txn;
      const iso = toIsoDate(date);
      if (!iso) {
        unparsed.push(line);
        continue;
      }
      transactions.push({
        isin: currentIsin,
        fundName: currentFundName,
        planLabel: currentPlanLabel ?? "",
        folio: currentFolio,
        date: iso,
        description: description.trim(),
        amount: toNumber(amount),
        units: toNumber(units),
        price: toNumber(price),
        unitBalance: toNumber(unitBalance),
        lineRef: `${currentFolio}:${iso}:${description.trim()}:${amount}:${unitBalance}`,
      });
      continue;
    }

    // Anything else (portfolio summary, page headers, legal footnotes,
    // nominee lines, "Opening Unit Balance: 0.000") is expected noise, not a
    // parse failure - only a line that looks transaction-shaped but didn't
    // fully match is worth surfacing.
    if (/^\d{2}-[A-Za-z]{3}-\d{4}\s/.test(line) && !DATE_RANGE_HEADER_RE.test(line)) {
      unparsed.push(line);
    }
  }

  return { transactions, folios, unparsed };
}

/**
 * Only the real purchase/sale/dividend rows: drops a stamp-duty line (no
 * units - already filtered by shape, since it has no numeric-only trailing
 * quadruple) and anything the caller doesn't recognize as a buy yet. No SELL
 * or DIVIDEND wording has been confirmed against a real CAS - every row here
 * is currently a BUY; a future statement with a redemption or an IDCW payout
 * will need its own description pattern added once one is actually seen,
 * rather than guessed at now.
 */
export function classifyAsBuy(row: CasTransactionRow): boolean {
  return !/redeem|redemption|dividend|idcw|switch.?out/i.test(row.description);
}
