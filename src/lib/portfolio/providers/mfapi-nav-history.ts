import { FETCH_HEADERS } from "./types";

// Historical NAV per scheme, keyed by AMFI scheme code (the same code pinned to
// Instrument.externalId for the AMFI daily-NAV provider, so no extra mapping).
//
// AMFI's own NAVAll.txt is today's NAV only, and the local Price table only
// starts the day this app first fetched a working NAV. Applying a SIP debit
// needs the NAV on the day the units were actually allotted, which may be weeks
// back, so it has to come from a history source.
const MFAPI_SCHEME_URL = (schemeCode: string) =>
  `https://api.mfapi.in/mf/${encodeURIComponent(schemeCode)}`;

/**
 * A fund's published NAV history: `YYYY-MM-DD` → NAV, plus the dates sorted
 * ascending so a lookup can walk forward from a debit date.
 *
 * The set of dates in here is the fund's business-day calendar. AMFI publishes
 * a NAV only on days the market settles, so weekends and public holidays are
 * simply absent: 15 Aug (Independence Day) has no row, and neither does any
 * Saturday. That is why this needs no hardcoded holiday list, which would go
 * stale every year and still miss the exchange-specific closures.
 */
export type NavHistory = {
  schemeCode: string;
  navByDate: Map<string, number>;
  dates: string[]; // ascending
};

/** `YYYY-MM-DD` for a UTC-midnight date, the key format used throughout. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse mfapi.in's `DD-MM-YYYY` into a `YYYY-MM-DD` key. */
function parseMfapiDate(value: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export function parseNavHistory(
  schemeCode: string,
  payload: unknown,
): NavHistory {
  const rows =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : null;
  if (!Array.isArray(rows)) {
    throw new Error(`NAV history for ${schemeCode} had no data array`);
  }

  const navByDate = new Map<string, number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const { date, nav } = row as { date?: unknown; nav?: unknown };
    if (typeof date !== "string" || typeof nav !== "string") continue;
    const key = parseMfapiDate(date);
    if (!key) continue;
    const value = Number(nav);
    if (!Number.isFinite(value) || value <= 0) continue;
    navByDate.set(key, value);
  }

  if (navByDate.size === 0) {
    throw new Error(`NAV history for ${schemeCode} parsed empty`);
  }

  return {
    schemeCode,
    navByDate,
    dates: [...navByDate.keys()].sort(),
  };
}

/**
 * Retried because this runs once a day, unattended, and a single cold DNS or
 * TLS handshake was enough to fail the fetch about one run in three during
 * testing. A miss is recoverable (the next run catches up on the debit), but
 * silently deferring someone's units on a coin flip is not good enough.
 */
const FETCH_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

export async function fetchNavHistory(schemeCode: string): Promise<NavHistory> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(MFAPI_SCHEME_URL(schemeCode), {
        headers: FETCH_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(
          `NAV history fetch failed for ${schemeCode} (${res.status})`,
        );
      }
      return parseNavHistory(schemeCode, await res.json());
    } catch (e) {
      lastError = e;
      if (attempt < FETCH_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }

  throw new Error(
    `NAV history for ${schemeCode} failed after ${FETCH_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : "unknown error"
    }`,
  );
}

/**
 * How far past the debit date we will look for a NAV before giving up. A normal
 * weekend is 2 days and the longest run of market holidays plus a weekend is
 * comfortably inside a week. Anything beyond this is not a holiday, it is a
 * fund that stopped reporting or a wrong scheme code, and guessing a price
 * there would silently invent a purchase.
 */
export const MAX_ALLOTMENT_LAG_DAYS = 10;

export type AllotmentNav = {
  navDate: string; // YYYY-MM-DD actually used
  nav: number;
  lagDays: number; // 0 when the debit date was itself a business day
};

/**
 * The NAV a debit on `dueDate` would be allotted at: the first NAV published on
 * or after that date.
 *
 * Indian mutual funds allot units at the NAV of the day the money is realised,
 * so a debit on a business day uses that day's NAV, and a debit on a Saturday,
 * a Sunday or a public holiday rolls to the next published NAV. Reading the
 * roll straight off the published series means the answer stays right when a
 * holiday moves, when a state adds one, or when the exchange closes unexpectedly.
 *
 * Returns null when nothing has been published yet, which is the normal case
 * for a debit due today before the evening NAV upload, or a debit over a
 * weekend that has not reached Monday. The caller must leave the plan alone and
 * retry rather than reaching backwards for a stale price.
 */
export function resolveAllotmentNav(
  history: NavHistory,
  dueDate: Date,
  maxLagDays = MAX_ALLOTMENT_LAG_DAYS,
): AllotmentNav | null {
  const due = isoDay(dueDate);

  // Binary search for the first published date >= due.
  let lo = 0;
  let hi = history.dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (history.dates[mid] < due) lo = mid + 1;
    else hi = mid;
  }
  const navDate = history.dates[lo];
  if (!navDate) return null; // not published yet: wait for it

  const lagDays = Math.round(
    (Date.parse(`${navDate}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) /
      86_400_000,
  );
  if (lagDays > maxLagDays) return null;

  const nav = history.navByDate.get(navDate);
  if (nav === undefined) return null;

  return { navDate, nav, lagDays };
}
