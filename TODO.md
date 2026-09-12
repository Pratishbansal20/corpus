# Corpus: TODO

_Last updated 2026-09-13. Ordered by what unblocks the most. `PLAN.md` holds the
history of what is already built and why._

> **Working agreement:** nothing here gets executed without agreeing the approach
> first. Pick an item, we settle how to do it, then it gets built.

---

## 1. Correctness and safety

- **Click through TOTP setup for real.** Flagged when it shipped (2026-08-23) and never
  followed up on since: `confirmTotpSetup()` is verified at the DB/crypto level (a real
  encrypt → save → decrypt → verify cycle against live data) but the setup dialog itself
  has never been driven end to end in a real browser — an environment limitation at the
  time, not a known bug, but this is a passphrase-*recovery* path, worth confirming it
  actually works before depending on it to get back in.

Both items previously here (reversing a SIP execution, weekly/quarterly auto-apply) shipped
2026-08-24. See `PLAN.md`.

## 2. Data depth

| Item | Why |
|---|---|
| **Historical price backfill** | `Price` starts at the 2026-06-29 seed, so the trend chart can never show more than a few weeks and XIRR would have no history. Yahoo and mfapi both serve years of daily data. |
| **Corporate actions** | Splits, demergers and bonus issues have no representation. The Tata Motors demerger left two dead tickers that silently stopped pricing for six weeks. Every future one is a manual repair. |

### Splitwise: receivables and payables

Money owed both ways is real net worth and is currently missing entirely. Feasibility
checked: the API is public and a good fit.

- `https://secure.splitwise.com/api/v3.0/`, authenticated with a **personal API key** from
  `secure.splitwise.com/apps`. No OAuth callback or token refresh for a single-user app.
  Stored AES-256-GCM encrypted via the existing `lib/crypto/encryption.ts`, the same way
  bank account numbers already are.
- `get_friends` returns each friend with `balance: [{ currency_code, amount }]`, positive
  meaning they owe you. `get_groups` gives group balances, `get_current_user` identity.
- **Balances only**, no expense history. One row per friend and per group, so Accounts can
  show who owes what and the totals are derived rather than opaque.
- Net worth gains **receivables as an asset** and **payables as a liability**, kept gross
  rather than netted so the composition line tells the truth.
- Refreshed in the daily cron, degrading gracefully like every other provider: the API is
  rate-limited with HTTP 429 and the limits are not published, so one call per run and keep
  the last good figures on failure.

Open detail for build time: balances carry a currency code, and only USD/INR is wired
today. Convert what we can, and surface anything else rather than silently dropping it.

## 3. Features

✅ **XIRR, mutual funds only** — done 2026-09-13, see `PLAN.md`. Deliberately not
per-holding on `/holdings`: every stock/ETF holding's only Transaction row is a
fabricated-date opening-balance stub, so it stays out of XIRR entirely (no `—`
placeholders in that table) until a real dated purchase exists for one. Lives on
`/funds` instead — per-fund in each fund's card, one combined figure in the
"Where you stand" row. `lib/portfolio/xirr.ts` is fully general (any asset class,
any currency), so equities pick it up automatically the day they get real dates,
no code change needed.

| Item | Depends on |
|---|---|
| **CSV import** (`/import` is still a placeholder): upload, validate, preview, idempotent commit | `Transaction` ✅ |
| **Dividend tracking** | `Transaction` ✅ |
| **Capital gains and tax estimate** | `Transaction` ✅, corporate actions |
| **Benchmark comparison** against NIFTY and the S&P 500 | backfill |
| **Goal tracking**: target net worth with a progress read | |
| **Watchlist** | |
| **Stock fundamentals on click**: P/E, P/B, market cap, dividend yield, 52-week range. Same Yahoo source already used for prices, a different endpoint (`quoteSummary`, not `chart`); a fund shows expense ratio/AUM/category instead, since "fundamentals" means something else for a mutual fund | |

### Stock/ETF SIP auto-apply

`SipPlan` (2026-09-11) can now target a listed stock or ETF, not just a mutual fund — a gold
ETF SIP was the real case that prompted it. But auto-apply only actually works for mutual
funds today: it degrades gracefully for a stock/ETF plan (skips with `NO_SCHEME_CODE`, same
as any fund missing an AMFI code), so units still have to be added to the holding by hand
after each debit.

- **Not a hard limitation, just unbuilt.** `applyDueSips()` prices a mutual-fund debit off
  `resolveAllotmentNav(history, dueDate)` — the *due date's* NAV, not today's — because the
  cron catches up on a backlog (a missed run applies every outstanding debit in date order),
  and pricing a three-day-old debit at today's price would silently misprice it. The
  equivalent for a stock/ETF needs the same shape: a historical-price-by-date fetch, not the
  latest-quote-only `fetchYahooPrice()` in `lib/portfolio/providers/yahoo-equity.ts`.
- **Yahoo's chart endpoint already supports this.** It's the same host `fetchYahooPrice()`
  already calls, just with a date range instead of `range=1d`. Needs a
  `fetchYahooPriceHistory(symbol, from, to)` alongside it, plus a `resolveAllotmentPrice`
  mirroring `resolveAllotmentNav`'s weekend/holiday walk-forward (the exchange closed that
  day → use the next trading day's close, same as a NAV not being published yet).
- Once that lands, `applyOneDebit()` in `lib/sips/apply.ts` needs no schema change — it
  already keys off whichever `Instrument` the plan points at.

### 1-day returns, per holding and per app

Alongside the existing since-purchase P/L: how much a holding — or a whole app group in the
"where it lives" consolidation — moved just today. Unlike XIRR, this does **not** depend on
the `Transaction` blocker: `Price` is already a real time series (unique per
`instrumentId`+`asOf`, never overwritten), so 1D change is just `(latest price - prior
trading day's price) / prior trading day's price`, no new pricing work needed.

- `AppGroup` (`lib/holdings/consolidation.ts`) gains `pnl1dInr`/`pnl1dPct` alongside its
  existing `pnlInr`/`pnlPct`; `HoldingView` (`lib/portfolio/valuation.ts`) the same, shown as
  one more column in the holdings table next to P/L.
- **"Prior day" means prior *trading* day, not prior calendar day.** A missing `Price` row
  for yesterday is a weekend or market holiday, not zero movement — the same business-day-gap
  gotcha the NAV series already has (see Known Gotchas in `ARCHITECTURE.md`). Walk back to
  the most recent row that actually exists rather than assuming yesterday has one.
- A holding with no fresh price today (a stale or failed provider) shows no 1D figure rather
  than a stale-looking 0.00% — the same "last good price, never a fabricated one" contract
  every provider already follows.

### News: holdings and market, with a tone read, not a signal

Two feeds: news for what's actually held (matched to each `Instrument.name`, shown
per-holding), and general market news alongside it, since a portfolio app's version of
"the news" is mostly the former but is thinner without the latter for context.

- **RSS first, scraping only if a source has no feed.** Moneycontrol, Economic Times
  Markets, LiveMint and Business Standard all commonly publish per-section RSS; that's the
  same reasoning that put AMFI's plain-text NAV file and mfapi.in ahead of scraping Groww
  for holdings, and it should get the same diligence Splitwise's API got before committing
  to it: check each candidate feed is actually live and structured before writing a parser
  against it.
- **Matching news to a holding is a name-match problem**, the same shape as AMFI's fallback
  fund matching (`normalizeName()` in `amfi-nav.ts`): a ticker rarely appears verbatim in a
  headline, so this matches on company/fund name, one-directional and shortest-match-wins,
  same as that fallback already does.
- **Sentiment is a tone indicator, not a signal.** Classify each story (or a per-company
  rollup) positive/negative/neutral and show it as a quiet marker next to the headline,
  never as a "buy/sell/exit" badge. This is the one feature here that reads closest to
  giving investment advice, and the app's own voice should stay descriptive ("mixed
  coverage this week") rather than directive.
- **Graceful degradation, same contract as every provider**: a dead feed skips that source
  and keeps the rest, never blanks the whole feed. Refreshed on a schedule (the existing
  daily cron, or its own), not on every page load.
- Open question for build time: whether a source's headlines need an LLM pass to normalize
  length/tone across sources, or whether RSS titles (already short) are clean enough as-is;
  more likely useful for collapsing near-duplicate stories about the same event from three
  different outlets into one.

### IPO tracker, checked against a standing checklist

Current and upcoming IPOs, subscription status, GMP, and news, plus a fixed checklist run
against every single one and reported the same way each time — the checklist itself still
to be supplied; the feature should take it as configurable input, not hardcode today's list.

- **GMP is informal by nature.** No regulator publishes grey market premium; it's trader
  chatter aggregated by sites like Chittorgarh and IPO Watch. Worth surfacing with a
  visible "unofficial, changes constantly" note rather than presenting it as a hard number.
- **The checklist can reuse the PDF/LLM pattern already planned for holdings import.** A
  prospectus (RHP) is a PDF, officially published on NSE/BSE and the registrar's site;
  extracting its text and asking an LLM to evaluate it against a fixed list of criteria is
  the same mechanism as CAS extraction, pointed at a different document and a different
  target shape (checklist verdict, not portfolio rows).
- Open question for build time: the actual checklist (mine to supply), and whether
  SME-platform IPOs are in scope from day one — their data is markedly less consistent
  across sources than mainboard IPOs, so mainboard-first is the safer starting scope.

### Multi-user: a few trusted people, each their own data

Closer to ready than it looks. `Holding`, `BankAccount`, `CreditCard`, `SipPlan` and the
rest are already scoped by `userId`; `UserSecurity` and `Session.unlockedAt` (the
passphrase gate) are already per-user, not per-app; and the daily cron already loops
`prisma.user.findMany()` and writes a snapshot per user. The gap is narrower than
"multi-user support" sounds:

- **`OWNER_EMAIL` is a single string, checked in two places** (`auth.ts`'s `signIn`
  callback, and again in `requireUser()` as defense-in-depth). Becomes a short allowlist
  instead of a single equality check — an env var list is the minimal version, a DB-backed
  table is the more flexible one (add/remove a trusted person without a redeploy), worth
  deciding at build time.
- **No new auth code path needed.** Each trusted person signs in with their own Google
  account exactly as today; the only change is who the allowlist admits. Google OAuth was
  already multi-account-capable, only the gate was single-account.
- Open question for build time: whether "their own data" should stay fully separate (no
  visibility into each other's holdings at all, the default the schema already gives) or
  whether a shared household view is ever wanted — different feature, worth being explicit
  it's not what this is by default.

### Bank / UPI transactions: manual statement import, not Account Aggregator

Looked into the Account Aggregator framework properly and closed it out rather than leaving
it open. **Account Aggregator** is the RBI-sanctioned, consent-based way to get live access
to a person's financial data in India — a licensed AA (Setu, Finvu, CAMSfinserv, OneMoney and
others) brokers consent between a **Financial Information User** (the app requesting data)
and **Financial Information Providers** (banks; also CDSL/NSDL and CAMS/KFintech, now that
AA covers demat and mutual-fund holdings too). It is not a path available to a single-user
app like this one: **only entities already regulated by RBI, SEBI, IRDAI or PFRDA are
eligible to become an FIU at all** — an unregulated app has no direct route regardless of
paperwork or patience. Where estimated, the process (for an entity that already clears that
bar) runs 5–10 months and ₹5–25 lakh+ in year-one cost — becoming a regulated financial
entity purely to read one person's own accounts. The one workaround, routing through an
already-regulated entity that acts as FIU on your behalf, trades a clean integration for
depending on someone else's consumer product; no concrete option for that turned up. This
closes out the portfolio-holdings angle the same way — Groww/Paytm Money/INDmoney have no
API of their own either (see PDF/LLM holdings import below).

- **UPI doesn't need its own integration**, moot now anyway: UPI transactions already appear
  as line items inside the bank statement they settle through, which is exactly the
  "Financial Information" an AA would have served.
- **Manual statement import is the actual plan, not a stopgap.** Upload a bank-exported
  PDF/CSV statement, parsed and categorized the same way the PDF/LLM holdings import works
  below — same pipeline, same reasoning, pointed at a different document shape.

### PDF / LLM holdings import

A pasted-in PDF, either a CDSL/NSDL/CAMS-KFintech CAS or a broker's own holdings export
(Groww, Paytm Money, INDmoney), is the fastest way to load a position without typing it in
by hand, and every source lays the numbers out differently. A fixed-format parser only
covers one shape; extracting the PDF's text and handing it to an LLM to return structured
rows (symbol/scheme name, quantity, average price, and a date where the source has one)
survives that layout variance without a bespoke parser per broker.

- **Text extraction first, vision as fallback.** Every CAS and broker export seen so far is
  a text-layer PDF, not a scan, so a text-extraction pass is the default attempt; only fall
  back to a vision-capable call if extraction comes back empty.
- **The LLM proposes, the existing resolution logic disposes.** Extracted rows still go
  through the same instrument search / resolution path already built for manual entry
  (`lib/instruments/search.ts`), never trusted to invent a `symbol` or AMFI `externalId`
  directly, so a hallucinated ticker fails the same "nothing found" path a manual search
  miss would, rather than silently creating a bad instrument.
- **Preview before commit**, the same shape planned for CSV import: show every parsed row
  against what would be created or topped up, let a wrong row be dropped or corrected by
  hand, commit only on confirmation. The two imports should end up sharing that pipeline.
- **Loading current holdings needs no schema change.** A CAS or holdings-export PDF is a
  snapshot (quantity + average cost), which is exactly `Holding`'s current shape today. A
  *detailed* CAS (full per-folio transaction history) could backfill real purchase dates
  for XIRR, but that path depends on `Transaction` landing first, same as CSV import.
- Open question for build time: CAS PDFs are password-protected with a PAN-derived
  password, so the upload flow needs a password prompt, not just a file picker.
- **One CAMS/KFintech CAS was actually parsed and backfilled (2026-09-13, see
  `PLAN.md`)** — narrower than this feature (no upload UI, no LLM, no preview/commit
  step; a one-off script pointed at one exported statement) but it de-risked three of
  the four gaps below for that one document shape specifically:
  1. **ISIN → `Instrument` resolution.** `Instrument.isin` (unique, nullable) now
     exists in the schema and is populated for every fund the backfill touched.
     Still not a *general* resolver, though: `lib/instruments/search.ts` only searches
     by name, and the backfill script's ISIN→symbol mapping is hardcoded for the 7
     funds it already knew about, not a real lookup path a future importer could call.
  2. **`source` per folio turned out to be a non-issue this time**, not solved in
     general: every folio in the one real CAS checked happened to already be the same
     broker (GROWW), so no mapping question was needed. A CAS spanning multiple
     brokers still needs the one-time question back to the user this item originally
     described.
  3. **Real noise, now actually handled and tested**, not just observed: `*** Stamp
     Duty ***`, `***Cancelled***`, `***Address Updated...***` lines, and — confirmed
     for real, not hypothetical — a registrar legitimately posting two separate
     purchases on the same folio/date/description/amount (`lib/imports/cas-cams-kfintech.ts`,
     regression-tested).
  4. **Multi-folio → one Holding, exercised for real**: several of the 7 funds backfilled
     spanned 2–3 folios each, summed into the existing single `Holding` per
     (instrument, source) while each underlying folio-transaction got its own
     `Transaction` row, exactly as this item originally proposed.
- **No single CAS is complete.** Confirmed independently (see "why is my CAS missing
  folios" — a folio only appears if its email matches the one the CAS was pulled for): the
  importer should expect to merge multiple CAS pulls (different emails) and broker exports
  over time, not assume one document is ever the full picture.

## 4. It reaches you

- **Reminders**: card due dates and SIP debits over WhatsApp, SMS or email, driven by the
  existing daily cron. Needs a Twilio or SendGrid account.

## 5. Brand finish

- **Landing hero animation**: was written around the old five-arc ring mark (arcs flying in
  and snapping into a complete donut); needs rethinking now that the mark is the monogram —
  a C with the trend line drawn through it. Something like: the gather graphic's five
  converging lines resolve into that same ascending line, which draws itself and lands on
  the dot with a brass impact pulse, then the net worth counts up. Must render assembled and
  static under `prefers-reduced-motion`.

## 6. Housekeeping

- **Error monitoring** (Sentry). Needs a Sentry account and a DSN before there's anything to
  wire up; the SDK integration itself is a known shape, not a design decision.
- **`next` → 16.3.x**, when there's time to verify it properly. Pinned to `16.2.12` (patched
  against the 9 CVEs in 16.0-16.2.10) rather than the newer minor `next` itself bundles a
  fixed `postcss`/`sharp` under, since a minor bump on this fork is worth its own
  verification pass, not a drive-by. See [`PLAN.md`](PLAN.md) for the full reasoning and
  what's already accepted as low-risk in the meantime.

---

## Settled, not to be reopened

- **TMCV cost basis after the demerger.** Checked against the Paytm Money app: invested and
  returns match exactly. The app agrees with the broker, so there is nothing to apportion.
- **No stack migration.** 1,586 rows and 10 MB. Every real problem so far has been data
  quality, not technology, and none of them would have been prevented by a different
  database, ORM or framework.
