import { fetchOkWithRetry } from "@/lib/http/fetch-retry";

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
  try {
    const res = await fetchOkWithRetry(MFAPI_SCHEME_URL(schemeCode), {
      attempts: FETCH_ATTEMPTS,
      timeoutMs: FETCH_TIMEOUT_MS,
      retryDelayMs: (attempt) => 500 * attempt,
    });
    return parseNavHistory(schemeCode, await res.json());
  } catch (e) {
    throw new Error(
      `NAV history for ${schemeCode} failed after ${FETCH_ATTEMPTS} attempts: ${
        e instanceof Error ? e.message : "unknown error"
      }`,
    );
  }
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

/**
 * The NAV that priced this fund on or immediately before `date` - "what was
 * this position worth on this past day," the opposite direction from
 * `resolveAllotmentNav`'s "what will a debit due on this day be priced at."
 * Used to value a fund's position at the start of a trailing XIRR window
 * (1M/6M/...), not just at allotment. Returns null when the fund's own
 * published history doesn't reach back that far - a window older than the
 * fund itself, which is common here (several of these are recent NFOs) - so
 * the caller can report "not enough data" rather than guess.
 */
export function resolveNavAsOf(history: NavHistory, date: Date): AllotmentNav | null {
  const target = isoDay(date);

  // Binary search for the last published date <= target.
  let lo = 0;
  let hi = history.dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (history.dates[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  const navDate = history.dates[lo - 1];
  if (!navDate) return null; // the fund's history starts after `date`

  const nav = history.navByDate.get(navDate);
  if (nav === undefined) return null;

  const lagDays = Math.round(
    (Date.parse(`${target}T00:00:00Z`) - Date.parse(`${navDate}T00:00:00Z`)) /
      86_400_000,
  );
  return { navDate, nav, lagDays };
}

type CachedHistory = { history: NavHistory; fetchedAt: number };

// NAVs publish at most once a day, so a page load re-fetching a fund's full
// history every single visit is pure waste - this is a cross-request,
// process-lifetime cache (survives Next.js dev hot-reload the same way the
// Prisma client singleton does; resets on a real redeploy, which is fine
// since the next request just repopulates it). 12h, not 24h, so a fund's
// figures aren't stuck showing yesterday's NAV for a full day after today's
// actually publishes.
const NAV_HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const globalForNavCache = globalThis as unknown as {
  navHistoryCache?: Map<string, CachedHistory>;
};
const navHistoryCache =
  globalForNavCache.navHistoryCache ?? new Map<string, CachedHistory>();
globalForNavCache.navHistoryCache = navHistoryCache;

/**
 * `fetchNavHistory`, cached. On a fetch failure, degrades to the last good
 * cached copy rather than failing outright - the same "last good, never
 * blank" contract every price provider in this app already follows - and
 * only returns null when there has never been a successful fetch at all.
 */
export async function getCachedNavHistory(
  schemeCode: string,
): Promise<NavHistory | null> {
  const cached = navHistoryCache.get(schemeCode);
  if (cached && Date.now() - cached.fetchedAt < NAV_HISTORY_CACHE_TTL_MS) {
    return cached.history;
  }
  try {
    const history = await fetchNavHistory(schemeCode);
    navHistoryCache.set(schemeCode, { history, fetchedAt: Date.now() });
    return history;
  } catch {
    return cached?.history ?? null;
  }
}
