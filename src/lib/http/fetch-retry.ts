// Central retry-with-timeout for outbound fetches.
//
// Before this, the retry loop was copy-pasted in the NAV history provider and
// search, and the Yahoo and AMFI providers had no retry at all. A cold-start
// server process pays a DNS/TLS handshake that has been measured at 8-9
// seconds here, while every request after it lands in well under one, so a
// single-attempt fetch on a tight budget fails the *first* call of a process
// every time. Cold-start failures have bitten twice.
//
// Contract: retries on network-level failure (the fetch itself throwing, or
// the timeout firing) up to `attempts` times, and returns whatever response
// it gets on the *last* attempt even when that response is not ok. A non-ok
// response is not itself a reason to retry: a 404 legitimately means "not
// found" (Yahoo relies on this to fall through from NSE to BSE without
// wasting a retry on an expected miss), so callers stay in charge of
// deciding whether a status code is success. Only when every attempt fails
// at the network level does this throw, so a caller that never got a single
// response can tell that apart from one that got a clean 4xx/5xx.

export const FETCH_HEADERS = {
  "User-Agent": "corpus/1.0 (+personal finance hub)",
  Accept: "text/plain, application/json, */*",
} as const;

export type FetchRetryOptions = {
  /** Total attempts, including the first. Default 2. */
  attempts?: number;
  /** Per-attempt timeout in ms. Default 12_000. */
  timeoutMs?: number;
  headers?: HeadersInit;
  /** Delay before the next attempt, given the attempt number that just failed. Default: no delay. */
  retryDelayMs?: (attempt: number) => number;
};

export async function fetchWithRetry(
  url: string,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const attempts = opts.attempts ?? 2;
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const headers = opts.headers ?? FETCH_HEADERS;

  let lastError: unknown;
  let lastResponse: Response | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      lastResponse = await fetch(url, {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastError = undefined;
      break; // got a response (ok or not): stop, the caller decides what it means
    } catch (e) {
      lastError = e;
      lastResponse = undefined;
    }
    if (attempt < attempts && opts.retryDelayMs) {
      await new Promise((r) => setTimeout(r, opts.retryDelayMs!(attempt)));
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error
    ? lastError
    : new Error("fetch failed after retries");
}

/** `fetchWithRetry` plus a `res.ok` check, for callers that just want JSON or throw. */
export async function fetchOkWithRetry(
  url: string,
  opts?: FetchRetryOptions,
): Promise<Response> {
  const res = await fetchWithRetry(url, opts);
  if (!res.ok) throw new Error(`fetch failed (${res.status})`);
  return res;
}
