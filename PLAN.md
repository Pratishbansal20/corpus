# Personal Finance Hub: Plan & Status (v3)

_Last updated 2026-08-24. This file is the changelog: what's built and the reasoning and bugs
behind each change, in the order it happened. For the standing architecture and design
decisions, see [`ARCHITECTURE.md`](ARCHITECTURE.md). For what's next, see [`TODO.md`](TODO.md)._
_Mirrored from the Claude Code plan; kept in-repo so it's openable on GitHub / the Claude app._

## Context
A **complete personal finance hub** for one user (the owner): investments (Indian stocks,
mutual funds, US stocks) + bank balances + credit cards + SIPs + credit score, unified into a
single **net-worth** view, plus a Tickertape-style **mutual-fund overlap/sector analysis**.
Holds sensitive data, so "nobody but me" security is first-class.
**Live:** https://corpusfinance.vercel.app

### Locked decisions
- Net worth = assets (investments + bank + other assets) − liabilities (credit-card outstanding).
- Cards: **last 4 only**, no PAN/CVV ever. Bank full acct number/IFSC optional + AES-encrypted.
- Access: **email allowlist** (`OWNER_EMAIL`) + **app passphrase** gate (`/unlock`).
- Base currency **INR**. Hosting: **Vercel, private + hardened**.

### Stack (as built)
- Next.js 16 (App Router) + TS monolith · PostgreSQL (Neon) + **Prisma 7** (pg adapter,
  `prisma.config.ts`, client → `src/generated/prisma`, gitignored).
- Auth.js v5 (Google, **database sessions**) · Tailwind v4 + shadcn (base-nova/Base UI) ·
  **recharts 3.9** · **vitest** (99 tests) · dark-first · money always `Decimal`.
- **Env vars**: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `OWNER_EMAIL`,
  `ENCRYPTION_KEY` (32-byte b64), `PRICE_STALE_HOURS`, `CRON_SECRET`.

---

## ✅ Delivered (all verified: `tsc` clean, `next build` green, 99 tests pass)

- [x] **M1 Setup**: scaffold, shadcn, dark theme, Prisma+Neon, app shell (sidebar/topbar/mobile nav).
- [x] **M2 Auth**: Google OAuth, DB sessions, `/login`, protected `(dashboard)`, user menu + sign-out.
- [x] **M3 Holdings CRUD**: manual add/edit/delete, idempotent instrument upsert, `source` tagging.
- [x] **M4 Finance model + Net Worth**: `BankAccount`, `CreditCard`, `SipPlan`, `CreditScore`,
      `ManualAsset`, `Session.unlockedAt`; net-worth aggregation (`lib/networth/compute.ts`);
      Net-Worth **Overview** home; **Accounts** page; **SIP tracker**; credit score in Settings;
      **app-wise consolidation** ("where it lives").
- [x] **M5 Security**: allowlist in `signIn` + `requireUser`; passphrase gate `requireUnlocked()`
      + `/unlock` (scrypt, `UserSecurity`); **AES-256-GCM** field encryption (`lib/crypto/encryption.ts`,
      tested); secure cookies; masked `•• 1234` in UI.
- [x] **M6 Cards + bank details**: CreditCard CRUD, due-date "Due in Nd" flags, utilization;
      optional encrypted full acct number/IFSC on bank accounts.
- [x] **M7 Pricing pipeline**: `PriceProvider` abstraction (AMFI NAV, Yahoo equity, Frankfurter FX)
      with caching + **graceful degradation**; manual Refresh; prices in `Price`/`FxRate`.
- [x] **M8 Charts + history**: recharts allocation donuts (asset class / country) + **net-worth
      trend**; `PortfolioSnapshot` extended; daily **Vercel Cron** (`/api/cron/refresh`, `vercel.json`,
      03:30 UTC) refreshes prices + writes snapshot; snapshot also written on manual refresh.
- [x] **M11 Mutual-Funds analysis** (`/funds`): overlap matrix (Σ min-weight, name-normalized),
      **true company exposure** (Σ fund₹×stock-weight), sector donut, per-fund **top-10 + "Show all"**.
      Real constituents via **`GrowwHoldingsProvider`** (scrapes Groww page-embedded portfolio JSON)
      with pinned slugs; `refreshFundHoldings()` replaces a fund's rows **only on a successful scrape
      (atomic): keeps previous data if Groww fails**; "Refresh holdings" button + in daily cron.
      All 7 funds real-sourced (26–251 holdings, 90–99% coverage).
- [x] **Data fix**: QQQ→**QQQM** (Invesco NASDAQ-100), $293.42; P/L now +4.4% (was a bogus +153%).

### Corrections vs earlier plan (now reality)
- MF holdings are **scraped from Groww**, not mfdata.in/manual-seed (mfdata.in down). mfapi.in is
  NAV-only, which is exactly why it now serves the historical NAVs that Phase 1.5 needs.
- Provider is `GrowwHoldingsProvider`, not the planned `MfHoldingsProvider(mfdata)`.

---

### Redesign (2026-07-07): shipped as **Corpus**
- [x] **Brass and Ink design system**: warm ink panels, muted antique brass accent (brass because
      green and red are reserved for gain and loss), Bricolage Grotesque display + Instrument Sans UI
      + IBM Plex Mono for all money. Rule: headline money uses the display face, tabular money uses
      the `.num` mono class.
- [x] **Signature `CompositionLine`**: every asset on one rule, liabilities notched below to the
      same scale. Landing hero animates the same idea.
- [x] **Shell**: sidebar carries a persistent net worth readout on every page; brass active rail;
      restyled topbar and bottom tabs.
- [x] **Overview**: leads with the figure + composition line instead of five equal tiles; hairline
      stat rail; SIP debits and card dues merged into one "Coming up" timeline.
- [x] **Public landing page** at `/`, product-first copy, no single-account caveat (the `/login`
      page still states it at the point of action).
- [x] **Logo**: ring of five arcs with one heavier brass arc closing it, plus `src/app/icon.svg`.
- [x] Aggregates format in whole rupees. Every em dash removed from copy and comments.

### UI pass (2026-08-02)
- [x] **Dropdowns were unreadable.** The app is dark-only through CSS variables but never declared
      `color-scheme`, so every native `<select>` popup was drawn by the browser in the OS *light*
      scheme: a white list that ignored the palette entirely. Adding `color-scheme: dark` to
      `:root, .dark` fixes it everywhere at once (popups, scrollbars, date pickers, autofill),
      with `select option` pinned to the popover tokens for the engines that honour them. The
      closed control now states its own background and text instead of inheriting platform
      colours. Measured after the fix: **14.6:1** in the option list, **16.1:1** on the control,
      both past WCAG AAA.
- [x] **Net worth over time gets 1M/3M/6M/1Y/3Y/5Y**, top right of the chart. The server had been
      loading only 90 days, so anything past 3M would have silently shown the same 90 days;
      `getNetWorthHistory` now defaults to the widest range the chart offers. The window is
      measured back from the newest recorded point rather than the wall clock, which keeps the
      component pure (a clock read during render breaks hydration) and means a stale account still
      shows its own last month instead of an empty chart. A note reads "N days recorded so far"
      whenever the window is wider than the history, so a young account never looks broken.
- [x] **Fund overlap scope moved to the top right** of its card header, on the title row where a
      control governing the whole card belongs, instead of floating above the grid on the left.
      Both it and the range picker are now the same `Segmented` component rather than two
      lookalikes that would drift apart.

### Getting money in (2026-08-05): search and top-up
Entering a lump-sum purchase was the worst job in the app. Adding a holding meant knowing the
exact ticker, the exact name and, for a fund, the AMFI scheme code looked up by hand, and getting
any of them wrong produced a position that silently never priced. Adding to a position you already
held meant doing the weighted-average blend yourself, which is invisible to get slightly wrong and
permanent once saved.

- [x] **Search by name** (`lib/instruments/search.ts`). mfapi.in for every AMFI scheme, which
      returns the scheme code, so the `externalId` that makes NAV pricing exact is filled in
      rather than looked up. Yahoo for equities. Picking a result fills type, symbol, name and
      scheme code, leaving only what was actually bought. "Enter it manually" is still there, so a
      brand new listing is never a dead end.
- [x] **Only offer what the app can actually price.** Indian stocks are quoted by appending `.NS`,
      so only NSE listings are offered and the bare ticker is stored. A Sao Paulo DRN, a Buenos
      Aires CEDEAR or a BSE-only line would be added and then never valued, so they are dropped.
- [x] **Funds are matched on scheme code, not symbol.** The seeded funds carry hand-made symbols
      like `JIOBR_FLEXI` while search offers `MF153859` for the same scheme. `resolveInstrumentId`
      now looks up the scheme code first, so picking a fund from search tops up the position
      already held instead of quietly opening a second one beside it.
- [x] **Top up** on every holding, separate from Edit on purpose: Edit *sets* quantity and average
      (for corrections), Top up *adds* (for purchases) and blends the average for you. Funds take
      a rupee amount priced at the NAV for the purchase date, using the same published-series
      lookup as the SIP path, so a date on a weekend or holiday resolves to the next NAV actually
      published. Stocks take a share count and price. Optionally debits a bank account, in the same
      transaction, exactly as a SIP does.
- [x] When no NAV exists yet for the chosen date (the common case: buying today, before that
      evening's upload) the error names the latest date that does exist, so it is one click to fix.
- [x] Search fetches retry once on a 12s budget. The first outbound request from a cold server
      process was measured at 8 to 9 seconds here while later ones take under one, so a single 8s
      attempt returned "nothing found" for the first search of every session.

Verified end to end against the live app on a throwaway holding, then removed: searched a fund,
confirmed all four plan variants were distinguishable, added it at 100 units and ₹50, topped it up
by ₹25,000 dated 4 Aug, and every figure matched a hand calculation exactly (267.787805 units at
NAV 93.3575, 367.787805 units, ₹81.568773 average, ₹30,000 invested, the linked account down
exactly ₹25,000). Real positions were never touched.

Note: top-ups still only mutate the holding. They record no date, so they remain invisible to
XIRR. They are the obvious first writer to the `Transaction` model in Phase 2.

### Bug fix (2026-08-07): five holdings had never been priced
An audit of every held symbol found five instruments still sitting on their
2026-06-29 seed price, with exactly one row in `Price`. They had never once received
a live quote, so for six weeks they showed cost basis dressed up as current value.
All five returned HTTP 404. The other 29 were pricing daily and were fine.

- `NVDA` was typed `IN_STOCK`, so the provider appended `.NS` and asked for `NVDA.NS`.
  Retyped `US_STOCK`.
- `VIKRAMSOLAR` is not the ticker; NSE lists it as `VIKRAMSOLR`. Renamed.
- `TATAMTRDVR` and `TATAMOTORS` are pre-demerger tickers. The correct instruments
  (`TMPV`, `TMCV`) already existed, so the Paytm holdings were moved onto them and the
  dead instruments deleted.
- `VENTURA` (Ventura Textiles) is **BSE-only**: it has no NSE listing at all, so no
  symbol change could have saved it. `fetchYahooPrice` now tries `.NS` then falls back
  to `.BO`, and search offers BSE listings too, ranked below NSE since both collapse to
  the same stored symbol.

After the fix: 34 instruments priced, 0 stale. The corrections moved real money, most
of it hidden in one position: `TMCV` on Paytm was up a meaningful, previously-invisible amount.
Checked against the broker's own app afterward: invested and returns matched exactly, so the
pre-demerger cost basis is correct as reported and was not adjusted further.

### Stale-price guard (2026-08-07)
The five above went unnoticed for six weeks because a wrong symbol fails **silently**:
Yahoo answers 404, the provider returns null, the refresh counts a skip, and the
holding keeps rendering its cost basis. The same silence hid the dead AMFI URL.

`findStalePrices()` now catches both shapes. The naive test, "no price in N days", is
the wrong shape: markets close for weekends and holidays, so it would cry wolf every
long weekend, and N would have to be so large that a dead symbol takes a fortnight to
surface. Instead each instrument is judged **against its own peers**, grouped by
instrument type, which self-adjusts to whatever the calendar is doing.

- `LAGGING`: one instrument far behind others of its type. Its peers priced today and
  it did not, so the calendar is not the explanation. This is the five-symbol bug.
- `SOURCE_DOWN`: a whole type far behind *today*. Peer comparison is blind to this
  because everything is equally stale, so the group's freshest price is also checked
  against the clock. This is the dead AMFI URL.
- `NEVER_PRICED`: no price row at all.

**N = 5 days.** The longest realistic run of non-trading days is a weekend wrapped
around consecutive public holidays, which reaches four. Five clears that, tolerates one
failed cron run, and still surfaces a broken symbol inside a week. For the peer check
it is pure slack: a healthy instrument is normally within a day of its group.

Surfaced as the first dashboard nudge, naming the symbols. Verified both ways against
live data: silent on the healthy portfolio, and on rolling `VENTURA` back to its old
prices it reported "1 holding is not pricing (VENTURA). The symbol is probably wrong."

### Net-worth chart: a 1W range, and an axis that actually scales (2026-08-07/08)
- [x] **Added a `1W` range** ahead of the existing 1M/3M/6M/1Y/3Y/5Y. A month was too coarse
      to see what a single SIP debit or a lump-sum purchase did to net worth.
- [x] **The y-axis was pinned to zero.** recharts defaults a numeric axis to `[0, 'auto']`
      (confirmed in the library source, not guessed). For a net worth that never approaches
      zero, that put every point in the top fifth of the plot with solid fill beneath it, which is also why
      switching ranges barely looked different: the top of the scale is the maximum, and the
      maximum is similar in every window. `niceDomain()` (`lib/networth/trend-range.ts`) now
      fits the axis to the values on screen, padded 8% and rounded to a step of 1/2/5 × a
      power of ten so ticks stay readable, never showing negative space for an all-positive
      series. Measured on live data: the line went from ~21% of the plot height (pinned to
      the top) to 43-46%, and `1W` now has visibly different geometry from `1M`.

### Bug fix (2026-07-31): SIP dates never refreshed
Two bugs, both fixed:
1. `nextDate` was only written by `saveSip`, so it froze at whatever was computed when the plan
   was last edited. Every SIP was showing a date in the past. `getSipPlans` now derives the next
   date from `dayOfMonth` on every read, so it cannot go stale, and the daily cron calls
   `rollForwardSipDates()` to keep the stored column in step.
2. Dates were built at *local* midnight, which under IST stored 18:30 the previous day and then
   rendered a day early on a UTC server (a SIP on the 25th displayed as the 24th). Calendar dates
   are now built with `Date.UTC` and rendered with `timeZone: "UTC"`. The same latent bug in
   credit-card due dates was fixed at the same time, along with month-length clamping so a due
   date on the 31st lands correctly in short months.

Covered by 6 new tests in `src/lib/sips/schema.test.ts`.

### Bug fix (2026-07-31): mutual funds had never been priced, and were modelled wrong
- **The AMFI URL was dead.** `portal.amfiindia.com/spp/navAll.aspx` returns 404 and always had,
  so `fetchAmfiNavMap()` threw on every run and the graceful-degradation path quietly kept the
  seeded placeholder prices. No mutual fund had ever received a live NAV. Fixed to
  `https://www.amfiindia.com/spages/NAVAll.txt` (13,979 rows, refreshed daily).
- **Name matching could pick the wrong fund.** The fallback matched in both directions, so a
  shorter AMFI name could swallow a longer holding: "Invesco India Midcap" was matchable against
  "Invesco India Large & Mid Cap". Now one-directional and prefers the shortest match, and all
  seven funds have `externalId` pinned to their AMFI scheme code so matching is exact.
- **Holdings were stored as `quantity = 1` with the rupee amount in `avgBuyPrice`.** That only
  survived because NAVs were broken. The first working refresh would have written a real per-unit
  NAV against a quantity of 1 and shown a several-thousand-rupee fund as ₹10. Converted all seven
  to real units and real average NAV, reconciled to the real portfolio figures on 31 Jul 2026.
  Values are now self-updating and survived a live refresh unchanged.
- **Added a stale-units nudge**: `countStaleMutualFunds()` flags any fund whose units have not
  changed in 15 days, since NAVs move on their own but a lump-sum purchase has to be entered.

Note: XIRR still cannot be computed (see Phase 2). The return figure the app cannot yet reproduce
comes from the broker.

### ✅ Phase 1.5: SIP auto-apply to holdings (done 2026-08-02)
SIP debits now update holdings. Previously a `SipPlan` stored only the schedule and nothing added
the purchased units to the `Holding`, so after every debit the app understated units and invested
until the position was edited by hand. That is why the numbers had drifted meaningfully below
reality by 31 Jul 2026.

**The debit date and the allotment date are not the same date.** A debit scheduled for the 1st
that falls on a Saturday is allotted at Monday's NAV, and the same happens on every public
holiday. Rather than carry a holiday calendar (which goes stale yearly and still misses
exchange-specific closures), the rule reads the shift straight off the published NAV series:
**the allotment NAV is the first NAV published on or after the debit date.** AMFI publishes a NAV
only on business days, so the series *is* the business-day calendar. Verified against the real
data: 15 Aug 2025 (Independence Day) and every weekend are simply absent from it.

- [x] `SipExecution` model (`sipPlanId`, `dueDate`, `navDate`, `amountInr`, `navUsed`,
      `unitsAdded`, `navSource`, `appliedAt`), unique on `(sipPlanId, dueDate)`. That key is what
      makes applying idempotent, so a cron that runs twice cannot buy the same units twice.
      `dueDate` and `navDate` are stored separately so the weekend/holiday shift is auditable.
- [x] **NAV history provider** (`providers/mfapi-nav-history.ts`). The local `Price` table only
      began at the 31 Jul 2026 fix and held exactly one row per fund, and AMFI's NAVAll.txt is
      today only, so neither could price a past debit. mfapi.in serves full per-scheme history
      keyed by the same AMFI scheme code already pinned to `Instrument.externalId`. Retries 3x
      with a 15s timeout: a cold DNS/TLS handshake failed roughly one run in three without it.
- [x] Daily cron applies every due, unapplied debit: `units = amount / nav`, `quantity += units`,
      `avgBuyPrice = (oldInvested + amount) / newQuantity`, execution row written in the same
      transaction. Runs before the snapshot so recorded net worth includes the new units.
      Averages are computed from money in, not from the rounded unit count, so invested stays
      exactly equal to the rupees debited.
- [x] **Catch-up**: `dueDatesBetween()` yields every scheduled debit in the window, so a cron that
      misses a fortnight applies both debits in order instead of dropping one.
- [x] Degrades gracefully: when no NAV exists on or after the due date (a debit due today before
      the evening upload, or a weekend that has not reached Monday) the plan is left alone and
      retried, never priced off a stale NAV. A gap longer than 10 days is refused outright, since
      that is a dead scheme or a wrong code, not a holiday.
- [x] Only `MONTHLY` plans auto-apply. `WEEKLY`/`QUARTERLY` store no anchor date, so generating
      monthly dates for a quarterly plan would buy three times the units. Left for Phase 2.
- [x] Surfaced on `/holdings` and `/funds` in the shape "Applied [date] at NAV [price] ·
      [units] units · [amount] from [Bank] ••[last 4]", showing both dates whenever the
      allotment shifted, and each SIP row carries "· from [Bank] ••[last 4]" so the linked
      account is visible without opening the dialog.
- [x] **Backfill decision: start from the reconciliation date, do not invent history.** Past
      debits are recorded nowhere, so `SipPlan.applyFrom` marks the last date already inside the
      stored quantity and only debits strictly after it are applied. The four existing plans were
      set to 2026-07-31, the date holdings were reconciled against the broker. New plans get
      today. `autoApply` is the per-plan escape hatch for a position kept in step by hand.
- [x] **The cash side: SIPs debit a linked bank account.** `SipPlan.bankAccountId` points a plan
      at the account its mandate hits, chosen from a "Debit from" dropdown in the SIP dialog
      (amount, day, frequency and bank are all editable there). On allotment the balance is
      decremented **inside the same transaction** as the units, so cash and units can never
      disagree. A SIP is a transfer, not a loss: the same rupees leave the bank and arrive as
      units, so net worth is unchanged and only its composition moves.
      - `SipExecution.bankAccountId` / `bankDebitedInr` record where the cash actually left, per
        execution, so re-pointing a plan at another bank later cannot rewrite past debits.
      - The account drops out with `onDelete: SetNull`, so deleting a bank unlinks the plan
        instead of destroying its history.
      - `asOf` moves to the debit date only when that is later, so a balance's freshness marker
        never travels backwards.
      - The balance is allowed to go **negative** on purpose. It is user-maintained, so a
        shortfall means it has gone stale, and clamping would hide exactly the kind of silent
        drift this whole phase exists to remove.
      - All four plans are linked to the same bank account, with several months of headroom
        at that account's balance against the combined monthly commitment.

Verified end to end against the live database: two missed debits (1 Jun, 1 Jul) were caught up in
order at their real published NAVs, quantity and invested matched a hand calculation to the paisa,
the linked account fell by exactly the amount debited while invested rose by the same amount,
re-running applied nothing and did not double-debit the bank, and the test state was then restored.
The current live state is the day-1 SIP correctly *waiting*, because 1 Aug 2026 was a Saturday and
Monday's NAV is not out yet.

### Central fetch-retry, and PDF export (2026-08-10)

**One retry helper instead of three.** Retry-with-timeout had been copy-pasted into the
NAV history provider and search, and the Yahoo and AMFI providers had none at all, so a
cold-start DNS/TLS handshake (measured at 8-9s here) could still silently leave a mutual
fund on its seeded NAV or a stock unpriced. `lib/http/fetch-retry.ts` is now the one place
that owns it: `fetchWithRetry()` retries a network-level failure (the fetch throwing, or
the timeout firing) up to `attempts` times, and returns whatever response it gets on the
last attempt whether or not it's ok, so a non-ok status is never itself a reason to retry.
That distinction matters for Yahoo specifically: a 404 there means "not listed on this
exchange", which is how a BSE-only stock like Ventura Textiles is supposed to fall through
from `.NS` to `.BO`, and retrying an expected miss would only slow that down.
`fetchOkWithRetry()` adds the `res.ok` check back for callers that just want JSON or a
thrown error. Search and the NAV history provider had their bespoke loops retired in favour
of it; Yahoo and AMFI gained retry they never had.

**PDF export**, reachable from Settings. `lib/pdf/report-data.ts` gathers net worth,
the full portfolio (holdings, allocation by asset class and country, the app-wise "where
it lives" breakdown), bank accounts and credit cards into one plain object, and
`lib/pdf/build-report-pdf.ts` renders it with `jspdf` + `jspdf-autotable`. Nothing here
reaches for a full account number or IFSC: the query layer that already masks the
dashboard to `•• 1234` is the same one this reads from, so there is nothing to redact at
render time because it was never fetched in the first place. `GET /api/export/report` is
gated by `requireUnlocked()` like every other page and streams the PDF as an attachment.

One real bug along the way: jsPDF's built-in fonts (Helvetica, Courier) only cover
WinAnsi's Latin range, and ₹ falls outside it and rendered as a missing-glyph box.
Money in the PDF is formatted as "Rs. 12,34,567" instead of reusing `formatInr()`'s
`Intl.NumberFormat` currency style, which is what prints the ₹ glyph. A test asserts the
byte stream never contains the raw glyph, so a future call site that reaches for
`formatInr` here by habit fails immediately instead of shipping a report with boxes in it.

### Route-level loading UI, and a logo pass (2026-08-21)

**Why the Investments tab felt slow to switch to, and it wasn't just Investments.**
Nothing under `src/app` had a `loading.tsx`, and `(dashboard)/layout.tsx` itself awaited
`getPricingStatus()` and `getNetWorthTotals()` before returning anything — including the
`<Suspense>` boundary Next inserts around a page's own `loading.tsx`. A page-level
`loading.tsx` alone would not have fixed this: the shared layout wraps every dashboard
page, so as long as it blocked on data, a nav click sat frozen with nothing streaming, no
matter how fast the target page was. Worse, `getPricingStatus()` and `getNetWorthTotals()`
each call `getUserPortfolio()` internally, and a page like Holdings called it *again* for
its own render — one navigation there ran the full priced-portfolio build (holdings query,
price lookups, an FX rate lookup) three times over.

Fixed in two parts:
- `getUserPortfolio()` (`lib/holdings/queries.ts`) is now wrapped in React's request-scoped
  `cache()`, so repeat calls with the same `userId` within one request collapse to the
  first call's in-flight promise. Three portfolio builds per navigation become one.
- `(dashboard)/layout.tsx` still awaits `requireUnlocked()` (the security gate: nothing
  should stream before it resolves) but no longer awaits the net-worth/pricing data. That
  fetch starts once, un-awaited, and is handed down as a plain `Promise` to `Sidebar` and
  `TopbarShell`. Each suspends on only the small slice it needs (`use(dataPromise)` inside
  a child component, wrapped in its own `<Suspense>`), so the nav, wordmark and page
  content all paint immediately and only the net-worth figure and the sync pill show a
  brief shimmer.

With the shell unblocked, a `loading.tsx` per dashboard page (`dashboard/`, `holdings/`,
`funds/`, `accounts/`, `cards/`, `settings/`) now actually does what it looks like it does:
Next swaps it in the instant a nav click fires, before the target page's data has
resolved. Each one traces its real page's layout (`components/layout/loading/`
`skeleton-kit.tsx`: `SkeletonCard`, `SkeletonRow`, `SkeletonStatRail`,
`SkeletonCompositionLine`, `SkeletonDonut`) so nothing shifts when real content lands, and
every static label a page doesn't need data for (section headings, the page title) renders
as real text, not a skeleton, so the page identifies itself before anything else has
loaded. The one loading signature repeated on every page is `LoadingMark`
(`loading/loading-mark.tsx`): the same ring-of-arcs as the sidebar wordmark, except the
brass arc that normally sits still, closing the mark, sweeps around it instead for as long
as the page is still arriving. A new `.skeleton` shimmer and `.spin-ring` rotation
(`globals.css`) both go through the existing `prefers-reduced-motion` override, same as
every other animation in the app.

**Logo pass.** `icon.svg` had only ever been checked at 22px and 32px. Rendered to a
canvas and sampled at 16px (the actual browser-tab size) and against a white background:
contrast between the brass arc and the ink backing held up at both (162 of 255 at 16px on
dark, 237 on white), because the icon carries its own dark card background rather than
relying on the page behind it, so nothing needed to change there. What was actually
missing: `apple-icon.tsx` and `opengraph-image.tsx`, neither of which existed. Both are
generated with `next/og`'s `ImageResponse` reusing `icon.svg`'s exact ring geometry (same
viewBox, radii, `stroke-dasharray`, colour), so fidelity to the existing mark is exact by
construction, not eyeballed. `apple-icon.tsx` draws edge to edge with no rounded corners of
its own, since iOS applies its own corner mask on the home screen and stacking a second
rounded rect under that produces a visibly inset icon. `opengraph-image.tsx` skips a custom
font (Bricolage Grotesque would mean a build-time fetch from Google Fonts for one static,
build-cached image) and instead earns its keep with a small composition-line accent below
the wordmark — the app's own signature graphic, not a generic dark-mode wordmark card.
Added `metadataBase` to the root metadata export in the same pass: without it, `next build`
resolves the generated OG image against `localhost`, which is why the warning only shows
up in a production build, not `next dev`.

Verified: `tsc --noEmit` clean, all 111 tests green, `next build` prerenders `/apple-icon`
and `/opengraph-image` as static routes with no warnings. The loading states themselves
were checked on an unauthenticated scratch route (no session needed: `loading.tsx` exports
are pure) rendering all six side by side, confirmed error- and hydration-warning-free via
the console, with the shimmer and ring-spin animations and brand colours confirmed live via
computed styles. Screenshotting was unavailable in this session, and a session cookie
couldn't be forged to check the authenticated shell directly (correctly refused as an
auth-bypass action) — worth a look end to end in a real browser.

### CI, lint cleanup, and a dependency security pass (2026-08-22)

**CI**: `.github/workflows/ci.yml` runs `tsc --noEmit`, `eslint`, `vitest` and `next build`
on every PR into `main` and every push to `main`. Nothing here needs a live database:
every dashboard page is fully dynamic (server-rendered per request, never prerendered), so
`next build` only needs env vars to be present and correctly shaped, not to point at
anything real. Confirmed by building locally against nothing but placeholder values before
committing to the workflow. The env block is throwaway junk, not secrets, and says so
inline so a future edit doesn't mistake it for something that needs rotating.

**The 12 pre-existing lint errors, gone.** `SortHeader` in `holdings-table.tsx` was defined
inside the table's render body, so React remounted it from scratch on every sort click
instead of updating it in place; harmless today only because it holds no state of its own.
Moved to module scope, `sortField`/`onSort` passed in as props instead of closed over. The
sort comparator's `any`-typed `valA`/`valB` became `string | number`, matching what the
switch actually assigns. `CountUp`'s `setValue(0)` moved from directly in the effect body
into the `setTimeout` callback that already gated the animation start: same visible timing
(the timeout deferred a tick either way), no longer a synchronous state write from inside
an effect. `seed-portfolio.ts`'s `as any` on `country` became `as Country`, the enum Prisma
already generates. `cards/queries.ts` dropped an import of `CARD_NETWORK_LABELS` used only
by a re-export two lines down, which doesn't need the import at all. One more turned up
that wasn't in the original count of 11 (likely from the loading/logo pass the day before,
never linted since): an un-escaped apostrophe in Settings' copy.

**`.env.example` had a genuinely corrupted byte**, not a display artifact: all four
em-dash comments had decoded to U+FFFD (confirmed with `cat -A`), presumably from an
encoding step somewhere between writing and committing it. Replaced with plain hyphens.

**Dependency audit: 18 vulnerabilities (3 critical, 12 high, 3 moderate) → 4 (all high),
all four deliberately left as accepted, low-real-world-risk.** The three criticals sat
directly in the auth stack, which is the one place "nobody but me" can't be casual about:

- `next-auth` (`5.0.0-beta.31` → `.32`) and its `@auth/core` dependency (`0.41.2` → `0.41.3`,
  also pulled in via `@auth/prisma-adapter` `2.11.2` → `2.11.3`) fixed a config-error path
  that could leave `auth()` returning a populated session instead of failing closed — an
  existence check failing *open* is the worst shape of auth bug to carry. Also fixed: an
  email normalizer that ran before Unicode normalization (a homoglyph `@` bypass), an
  uncaught exception on a malformed Bearer header, and OAuth state/nonce/PKCE cookies not
  bound to the provider that set them.
- `next` (`16.2.9` → `16.2.12`, staying on the 16.2.x line on purpose) fixed 9 CVEs present
  from 16.0 through 16.2.10: middleware/proxy bypass, SSRF in Server Actions and in
  rewrites, a Server Action DoS, cache confusion on request bodies, and unauthenticated
  disclosure of internal Server Function endpoints.
- `prisma` / `@prisma/client` / `@prisma/adapter-pg` bumped `7.8.0` → `7.9.1` (latest patch,
  no CVE of its own here).

The remaining 12 turned out to be entirely dev/build tooling that never reaches the
deployed app: `prisma`'s own CLI config loader (`deepmerge-ts`, `fast-uri`, both nested
under `@prisma/config`/`@prisma/dev`), `eslint`'s YAML parser, and — the one genuine
surprise — `shadcn`'s CLI dragging in a full MCP SDK (`hono`, `ip-address`, `undici` via
`@modelcontextprotocol/sdk`) despite the app never running an MCP server. Eight of these
had a single, unconflicted resolution path and a same-major (or clean next-major, for
`deepmerge-ts`) patched version available, so they're pinned via a new `overrides` block in
`package.json`: `deepmerge-ts`, `fast-uri`, `js-yaml`, `nanoid`, `hono`,
`@hono/node-server`, `ip-address`, `undici`. `postcss` got a *scoped* override
(`@tailwindcss/postcss`, `shadcn`, `vite` individually, not a blanket one) specifically to
leave `next`'s own internally-pinned `postcss@8.4.31` alone. Verified after: `prisma
generate`/`prisma validate` both still run clean (exercises the new `deepmerge-ts` major
inside `@prisma/config`), and the dev server's computed styles were checked live
(`background-color`, font stack, `color-scheme: dark`) to confirm Tailwind's output survived
the `postcss` bump for its three other consumers.

**Four vulnerabilities left, deliberately.** `next` itself declares an *exact* pin on
`postcss@8.4.31` and a caret range `sharp: '^0.34.5'` as its own internal implementation
detail, both only fixed by moving to `next@16.3.2`, a minor version on a fork whose own
`AGENTS.md` warns "breaking changes... may differ from your training data" — that bump
deserves its own verification pass, not a drive-by inside a dependency-audit turn, so it's
back in [`TODO.md`](TODO.md). `sharp`'s CVEs (inherited libvips bugs) need attacker-supplied
image bytes reaching it to matter; the only image sharp ever touches here is the
authenticated user's own Google avatar from a fixed `lh3.googleusercontent.com` pattern, not
arbitrary uploads, so real exposure is close to zero either way. `postcss`'s CVEs need
attacker-controlled CSS with a crafted `sourceMappingURL` comment; the only CSS this app
ever runs through PostCSS is its own repository's, at build time, by the one developer who
owns it, so this is the same shape of non-issue. `brace-expansion` resolves to two different
incompatible majors at once (`1.1.15` under `eslint`'s `minimatch@3.x`, `5.0.6` under
`typescript-eslint`/`ts-morph`'s `minimatch@10.x`); forcing one version to satisfy both risks
breaking glob resolution in lint/build tooling to fix a DoS that requires an
attacker-controlled brace pattern, which never happens here since every glob involved is a
developer-authored config string, never user input.

Also checked in passing and **not** a fix: `dotenv@17.4.2` prints a random promotional "tip"
line on load (`⌁ auth for agents [www.vestauth.com]` among others). Read the source: it's a
static array fed to a single `console.log`, nothing resembling a network call anywhere in
the package, and the `vestauth.com` one is confirmed genuine self-promotion in the
maintainer's own changelog, not a supply-chain compromise. Noise, not a vulnerability.

### Investment returns chart (2026-08-22)

The net-worth trend chart conflates two different things: money added and money earned.
Noticed live: adding new investments produced a sudden jump that read like a windfall gain,
because a lump-sum top-up or a new holding raises `PortfolioSnapshot.totalValueInr` and
`investedInr` by roughly the same amount in the same instant (new units bought at today's
price cost roughly what they're worth today), and the net-worth line has no way to tell
"money went in" apart from "the market went up."

**No schema change, no backfill.** `PortfolioSnapshot` already stored both `totalValueInr`
and `investedInr` per user per day, so `getInvestmentReturnsHistory()`
(`lib/networth/snapshot.ts`) just reads the same rows `getNetWorthHistory()` does and
subtracts, in `Decimal` space (`totalValueInr.sub(investedInr)`, matching the exact pattern
`lib/portfolio/valuation.ts` already uses for the same subtraction elsewhere). Since a
top-up moves both sides roughly equally, this line does **not** show the jump the net-worth
chart does; that's confirmed, not assumed.

This is unrealized point-in-time P&L (current value minus cost basis), not a
time-weighted or money-weighted return. It says nothing about *when* each rupee went in,
only where things stand today versus cost; true XIRR needs cash-flow dates and stays
correctly blocked on the `Transaction` model.

**Follow-up, same day: two-tone coloring and a shared range control.** First cut colored
the whole line by the sign of the latest point, one color for the entire window. Live
feedback: a loss stretch should read as loss the whole way through, not just at the end.
`zeroCrossingOffset()` (`returns-trend.tsx`) finds where zero falls in the visible values
and feeds it to two hard-split gradient stops (`--gain` above, `--loss` below) shared by
both the stroke and the fill, so the line is unambiguously red wherever it's actually
negative — reduces to a solid single color automatically when a window never crosses zero,
no separate branch needed for that case.

Second piece of feedback: hovering one chart should highlight the same date on the other.
recharts supports this natively (`syncId`, synced by array index by default), but only
works correctly if both charts are showing the same window — two independently-driven range
pickers could drift apart with nothing stopping them. Rather than add a "these don't
match" fallback, removed the possibility: `PortfolioTrends`
(`components/charts/portfolio-trends.tsx`) now owns one `range` state and one `Segmented`
control for both charts, so "same timeline" is structurally guaranteed, not just usually
true. `NetWorthTrendChart` and `ReturnsTrendChart` were cut down to pure presentational
components (`points`/`domain`/`syncId` props, no state of their own); the range-picker and
`sliceToRange`/`niceDomain` slicing logic that used to live in each one now lives once, in
`PortfolioTrends`. Both `<AreaChart>`s pass the same `syncId`, which is all recharts needs
for the hover sync. Third round of feedback: the two cards were laid out side by side on
wide screens (mirroring the existing Allocation section's grid) — asked to stack them one
after another instead, so the grid lost its `lg:grid-cols-2`.

The section moved from two headings ("Net worth over time" / "Investment returns") to one
("Trends") with two card titles inside, since there's now one range control governing both,
not two. Still gated behind `hasInvestments` for the returns card specifically (net worth
renders regardless — it means something even with zero investments); still has a matching
`dashboard/loading.tsx` skeleton.

Verified after every round: `tsc`, `eslint`, all 111 existing tests, and `next build` all
clean; no new test file added, matching the precedent that DB-query mappers like
`getNetWorthHistory()` aren't unit-tested here, only the pure logic modules are
(`trend-range.ts`'s tests already cover `niceDomain`/`sliceToRange`, reused unchanged).
Checked against the live app twice: seeded a temporary pre-unlocked `Session` row per the
verification approach below, confirmed via the accessibility tree that the section renders
with the real heading, real numbers, a correctly-computed "N days shown" caption shared by
both charts, and (after the merge) exactly one "Trends time range" tablist rather than two —
then deleted the row both times. Pixel-level rendering (the actual red/green split, the
live hover sync) could not be confirmed in this session: the tab reported
`document.hidden: true`, which collapses recharts' `ResponsiveContainer` to 0×0 for every
chart on the page, not just these two, so it's an environment limitation rather than
anything specific to this feature. Confirmed structurally sound both times; worth a direct
look in a real browser for the part that actually matters here, the colors and the hover.

### PWA, and the Vercel function region (2026-08-23)

**Installable, same mark, no offline data.** `src/app/manifest.ts` (Next's auto-discovered,
auto-linked manifest convention) plus `src/app/icons/[size]/route.tsx`, a single dynamic
route generating the 192/512/maskable-512 PNGs Android's install prompt and app switcher
need. Neither is a new design: `CardMark` in the icons route is `icon.svg`'s markup
verbatim, just rasterized bigger; `EdgeToEdgeMark` is `apple-icon.tsx`'s composition (ink
fills the canvas edge to edge, no corner radius of its own, since the OS applies its own
mask shape) at the same 112:180 ring-to-canvas ratio, which leaves the ring well inside the
~80% "safe zone" a maskable icon needs to survive a circular crop unclipped. Verified by
fetching all three routes and reading the decoded PNGs back as images, not just checking
the response status: the mark renders correctly at each size, rounded card for `any`, edge
to edge for `maskable`.

`start_url: "/dashboard"` skips the marketing landing page on every launch, since an
installed PWA is opened by someone who already has an account; `requireUnlocked()` still
sends them to `/login` on its own if the session's actually expired, so this isn't a new
auth path, just a shorter one when it isn't needed. `appleWebApp` metadata added to
`layout.tsx` since iOS never fully honors the manifest's `display: "standalone"` on its own
and needs its own meta tags to drop the Safari chrome and match the status bar to the app's
own dark background.

**A service worker that caches nothing that matters.** `public/sw.js` intercepts exactly
one thing: a page navigation that fails because there's no network, which it answers with a
small branded `/offline` page instead of the browser's own error screen. Everything else
(JS/CSS bundles, API calls, every dashboard page) passes straight through untouched. This
was a deliberate ceiling, not a first step toward more: Corpus is fully dynamic (every
dashboard page is a live DB read per request), so there is no meaningful "offline data" to
serve in the first place, and this project has already been burned once by an
over-aggressive cache (Turbopack silently serving a stale build, see Known Gotchas below) —
a service worker that cached bundles or authenticated pages would be exactly that class of
bug, at browser-cache scope, on a finance app. Registered only in production
(`ServiceWorkerRegister`, `src/components/layout/service-worker-register.tsx`): a service
worker registered under `next dev` outlives the dev server that registered it, since
browsers keep it active across restarts, so registering nothing in dev means nothing to
unregister by hand after every restart.

**Two safe-area fixes for "smooth."** `mobile-nav.tsx` already padded itself with
`env(safe-area-inset-bottom)` for the notch/home-indicator, written before this session —
but the root layout's `viewport` export never set `viewportFit: "cover"`, so that padding
was silently resolving to `0` the whole time: without `viewport-fit=cover`, the browser
never extends layout into the safe-area region at all, so `env()` has nothing to report.
Added `viewportFit: "cover"`, which is what actually turns that existing padding on.
Applying it project-wide surfaced the matching gap at the top: `topbar.tsx`'s `sticky top-0`
header had no equivalent inset, so a notched/Dynamic-Island phone in standalone mode would
put the status bar directly over it. Same treatment added there, with `h-16` switched to
`min-h-16` first — Tailwind's `box-sizing: border-box` means a fixed `h-16` plus new padding
would have squeezed the header's own content into a shorter box instead of growing the
header, not extended it.

**Vercel function region.** `vercel.json` gained `"regions": ["sin1"]`. Checked, not
assumed: Neon's connection string resolves to `ap-southeast-1`, and `sin1` (Singapore) is
Vercel's matching region, so every function (every dashboard SSR request, the daily cron)
now runs physically next to the database it talks to on every single request, instead of
wherever Vercel's default happened to place it.

### Bug fix (2026-08-23): unlock never expired

Asked why the passphrase hadn't prompted in weeks. Checked the live data: `UserSecurity`
exists (set up 2026-06-28), and every one of the last 5 sessions already had `unlockedAt`
set. The gate wasn't broken — `unlockedAt` is only ever *set* (`lib/security/actions.ts`,
on initial setup and on `/unlock`), never cleared anywhere in the codebase, so once a
browser unlocks once, it stays unlocked for the life of that session cookie: Auth.js's
default `maxAge` (30 days, rolling forward on activity), which in practice is closer to
indefinite for a device in daily use. That quietly contradicts PLAN.md's own stated model
("a separate passphrase opens the session, so a borrowed phone is never a borrowed
portfolio"): any device unlocked at any point in that window got straight past the gate,
no matter how long ago.

`lib/security/unlock.ts` adds `UNLOCK_TTL_MS` (7 days, picked over 12h/30min/30-day
options) and `isUnlockExpired()`, a pure function so the boundary is unit-tested
(`unlock.test.ts`) without touching a database. `requireUnlocked()` now redirects to
`/unlock` when `unlockedAt` is either unset *or* older than the TTL — one extra condition
on an already-computed timestamp, no new query. Ordinary daily use never re-prompts; a
device untouched for a week does.

### New mark: the five-arc ring retired for a monogram (2026-08-23)

Explored logo directions on request (a multi-artboard design canvas plus a Figma file, both
outside the repo) and picked one: a flat-cut C, gap on the right like the plain letter, with
the trend line that's driving the number — a real one, rising, dipping, rising again, not a
ruler-straight arrow standing in for it — drawn through the gap and ending in a solid dot.
The old mark (five dashed arcs closing into a ring, one of them brass) is gone — this isn't a
variant of it, the ring-completing-into-a-donut idea is retired outright. Weight settled
after a few rounds of checking against real sizes (16px is the actual browser-tab favicon,
18 the topbar-mobile/loading-indicator size) *and* against the source design side by side —
those are two different checks, and the first pass here only did the first one, which is how
a too-thin line, then an accidentally-straightened line, then an overcorrected too-thick line
each shipped before landing on the final weight: ring stroke 3.4, line 1.5, dot r=1.

**Geometry now lives in one place, `src/lib/mark.ts[x]`**, not copied by hand across every
call site. `WordmarkGlyph` (`components/layout/wordmark.tsx`) and `LoadingMark` are the two
live React components (sidebar, topbar-mobile, `/login`, `/unlock`, the landing page, every
loading state) and read `@/lib/mark`'s `MarkRing`/`MarkLineAndDot` components directly;
`offline/page.tsx` does too. `apple-icon.tsx`, `opengraph-image.tsx` and
`icons/[size]/route.tsx` (both `CardMark` and `EdgeToEdgeMark`, so the PWA install icons match
too) render through `next/og`'s `ImageResponse`, which turned out not to render those
components at all — see [Known gotchas](ARCHITECTURE.md#known-gotchas) — so those three import
the same module's raw geometry constants instead and write the elements inline; one set of
numbers either way. `icon.svg` is the one file that's still hand-copied, unavoidably: Next's
favicon convention needs a literal static file, which can't import TypeScript.

### TOTP passphrase recovery, and an encrypted backup export (2026-08-23)

Two of the housekeeping items scoped earlier the same day, narrowed by explicit direction
before either was built: TOTP **only** for recovering a forgotten passphrase, never a
routine second gate on top of an already-unlocked session; backup encrypted with a
passphrase typed at export time, not the fixed `ENCRYPTION_KEY` every other field uses.

**TOTP recovery.** `UserSecurity` gained `totpSecretEnc`/`totpEnabledAt`
(`prisma db push`, then `prisma generate` — and then tripped the exact gotcha
`ARCHITECTURE.md` already documented: the long-running dev server had the *old* Prisma
client in memory, so `hasTotpRecovery()`'s `totpEnabledAt` select failed with "Unknown
field" until the dev server itself restarted, `prisma generate` alone wasn't enough).
`lib/security/totp.ts` wraps `otpauth` (secret generation, `otpauth://` URI, code
verification) and `qrcode` (SVG, rendered server-side, safe to inject via
`dangerouslySetInnerHTML` since the input is a URI this app built itself, never
user-supplied). Setup (`SetupTotpDialog`) is stateless on the server until confirmed: the
secret is generated and returned to the client for the QR code, but only written to the
database, AES-256-GCM encrypted the same way bank account numbers are, once a real code
from the authenticator app proves it was actually scanned — a setup abandoned mid-dialog
leaves no live, unconfirmed recovery method behind. Recovery itself
(`recoverWithTotp`, reachable from `/unlock` via "forgot your passphrase?", shown only when
recovery is set up) verifies a code against the stored secret and sets a brand new
passphrase in the same step, since the whole point is the old one is gone.

**Backup export.** `lib/backup/crypto.ts` derives an AES-256 key from the typed passphrase
via scrypt (same parameters as `lib/security/passphrase.ts`) with a random salt stored
alongside the ciphertext, so the file is self-describing and needs nothing but the
passphrase to open again — and deliberately shares no key material with `ENCRYPTION_KEY`,
so leaking a live backup file can never expose anything encrypted inside the running app,
or the other way round. `lib/backup/gather.ts` reuses `buildExportReportData()` (the PDF
export's own data gathering) wholesale rather than re-querying the same tables a second,
slightly-different way, adding only SIPs and credit scores, the two things a "restore my
data" snapshot wants that the PDF report doesn't already carry. Same masking contract as
the PDF export, and for the same reason: no full bank account number or IFSC is in the
payload, because nothing here ever decrypts or fetches one. `POST /api/export/backup`, not
`GET`: the passphrase has to travel in the body, never a URL. The download itself isn't a
server action (those return JSON, not a file) — `BackupExportDialog` does a real `fetch`
and turns the response into a browser download the way a plain `<a download>` would, since
a POST can't be one of those.

Verified past what the 9 new unit tests (`totp.test.ts`, `unlock.test.ts` predates this
entry, `crypto.test.ts` for backup) cover: a script exercised the *actual* encrypt → DB
write → read back → decrypt → verify-real-code / reject-wrong-code cycle against the live
`UserSecurity` row (reverted to its original `null` state after), and a second script hit
the live `/api/export/backup` route end-to-end — real 42 holdings and 4 SIPs came back,
decrypted correctly with the right passphrase, correctly refused the wrong one. Settings
was checked structurally (both new cards render, correct copy, correct buttons) via the
same seeded-session method noted below; interactively clicking through the dialogs was not
possible in this session (`document.hidden: true` again, the same limitation noted for the
portfolio-trends work above — not specific to this feature).

---

### Settings: recovery merged into the App passphrase card (2026-08-24)

Shipped the day before as its own separate "Passphrase recovery" card. Asked why it was a
distinct card instead of appearing alongside "Change passphrase" — fair question, since
both buttons act on the same passphrase and having two cards for it was more visual weight
than the feature earns. Merged: "Set up recovery" / "Turn off recovery" now sits next to
"Change passphrase" in the App passphrase card's header, and the card's one line of body
copy states recovery's status alongside the passphrase's. No behavior change, no new
queries — `canRecover` was already being read on this page.

Worth being explicit about the one thing that *didn't* change and can't: recovery still has
to be **set up in advance**, while signed in and the passphrase is still known. There's no
version of this where "forgot password" itself triggers setup — by the time a passphrase is
actually forgotten, there is nothing left to prove enrollment is legitimate. The existing
"forgot your passphrase?" link on `/unlock` is the only place recovery is *used*, and always
was; this change only touched where it's *set up*.

## Remaining backlog

Moved to [`TODO.md`](TODO.md), which is now the single ordered backlog (it separates
correctness/safety work from features from brand polish, rather than the phase numbering
this file used to carry). This file stays the changelog of what has already shipped.

---

### Bug fix (2026-08-24): AMFI changed its own file format, silenced every mutual fund at once

The "Refresh" button had started reporting "7 skipped (no quote found)" — always exactly 7,
always mutual funds. Traced it to `parseAmfiNavFile()`, not to anything in this app changing:
AMFI's `NAVAll.txt` used to carry one combined "Scheme Name" column (e.g. "... Fund Direct
Plan Growth" as one string); sometime between 2026-08-18 (the last date every fund had a
real price) and today, AMFI split that into three separate columns — Name, Plan, Option —
which shifted the NAV and Date columns two places to the right. The parser's hardcoded
indices didn't move with them: it read the new `Plan` column ("Direct Plan") as the NAV
figure, `Number("Direct Plan")` is `NaN`, the numeric-and-positive check silently dropped
the row, and this happened for every single row in the file, not just ours — a 14,000-row
file parsed to zero, `fetchAmfiNavMap()` threw "file parsed empty," and every mutual fund
in the portfolio was left exactly where it stood on the 18th while every stock kept pricing
normally, since Yahoo's format hadn't changed.

Fixed by reading the file's actual current shape (`Scheme Code;ISIN.../ISIN Growth;ISIN Div
Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date`, 8 columns) instead of the old
assumed 6. Name-fallback matching (used only when an instrument has no pinned `externalId`,
which is every fund actually held here, but not guaranteed for a future one) now rejoins
`Name + Plan + Option`, since a stored instrument name like "... Fund Direct Growth" would
otherwise stop matching against AMFI's now-shorter base name. Added a test that pins the
*current* 8-column layout as the expected shape, one that asserts the *old* 6-column layout
now correctly parses to zero rather than silently resurrecting this exact bug if AMFI's
column count ever changes again in the other direction, and one for the Name/Plan/Option
rejoin.

Verified against the live file, not just the fixture: fetched the real `NAVAll.txt` (14,041
schemes) and confirmed all 7 previously-stuck funds resolve by scheme code with real NAVs
dated 2026-08-21 (the last trading day before the weekend, consistent with every stock's own
latest price). Applied it for real — wrote the corrected NAVs to the live `Price` table for
all 7 funds, not just left the fix sitting in code until the next scheduled refresh.

This is the same failure *shape* as the 2026-07-31 AMFI outage (`ARCHITECTURE.md`'s
"Graceful degradation" section): an upstream provider changing its data unannounced, caught
by the fact that the whole type went silent at once rather than one symbol. `findStalePrices()`
would have flagged this as `SOURCE_DOWN` on the next dashboard load if it hadn't been caught
first — worth remembering that nudge exists for exactly this failure mode.

---

## Verification approach
- `npm test` + `tsc --noEmit` + `eslint .` + `npm run build` green before deploy; the same
  four run in CI (`.github/workflows/ci.yml`) on every PR and push to `main`.
- Authenticated pages cannot be screenshotted headlessly (the session cookie is httpOnly), so
  verify them by seeding a temporary pre-unlocked `Session` row and curling with that cookie,
  then deleting the row. For visuals, a temporary public page rendering the real components with
  sample data works well.
- DB spot-checks via a throwaway `node` + Prisma script.

Known gotchas moved to [`ARCHITECTURE.md`](ARCHITECTURE.md#known-gotchas), alongside the design
decisions each one is entangled with.

---

### Dismissible reminders, longer leashes for two of them, and a real /unlock bug (2026-08-24)

**Dismiss, session-only.** `RemindersList` (`components/layout/reminders-list.tsx`) adds an
X to each Overview nudge. Deliberately not persisted: these nudges exist to surface a real,
unresolved problem (a dead price feed, a balance nobody's touched), and a dismiss that
survived a reload would let a genuine one go quiet permanently — the opposite of the point.
Dismissing clears it for the rest of the visit; a reload (or the next day) shows anything
still actually true.

**Credit score and mutual-fund-units nudges, 15 → 45 days.** Bank/asset balances are things
you'd realistically touch often; credit score and MF lump-sums move on a slower, natural
cadence (a monthly bureau pull, an occasional lump-sum buy), so 15 days was nagging too
early for those two specifically. Bank/asset balances stayed at 15. The stale-*price* nudge
is unrelated and untouched: `findStalePrices()`'s 5-day peer-comparison check
(`STALE_PRICE_DAYS`, `lib/holdings/stale-prices.ts`) already existed before this change and
already matched what was asked for here.

**Bug fix: /unlock wouldn't redirect after a correct passphrase.** Entering the right
passphrase repeatedly did nothing visible; typing `/dashboard` into the address bar directly
afterward worked immediately. `unlockSession()` and `recoverWithTotp()` both call
`redirect("/dashboard")` after a real, successful DB write (`unlockedAt` genuinely updated
each time) — the update was never the problem. The redirect was landing on a *stale
client-side cache* of `/dashboard`: `next.config.ts` sets `staleTimes.dynamic: 30`, so the
earlier visit that got bounced to `/unlock` (rendered *while still locked*) stays cached
client-side as "redirects to /unlock" for up to 30 seconds. A soft navigation — exactly what
a server action's `redirect()` performs — can replay that stale cached response instead of
hitting the server again; a typed URL is a hard navigation and always bypasses it, which is
exactly the asymmetry that was reported. Every other mutation in this app already calls
`revalidatePath()` for precisely this reason (documented in `next.config.ts`'s own comment);
this one code path just hadn't needed it before the client router cache existed. Fixed with
one shared helper, `unlockCurrentSessionAndRedirect()`, called by both `unlockSession()` and
`recoverWithTotp()`: revalidates every route the `(dashboard)` layout gates (listed
explicitly — a route *group* has no shared URL prefix to revalidate in one call), then
redirects.

Verified: `tsc`, `eslint`, all 127 tests, `next build` all green. The redirect fix itself
could not be interactively click-tested in this session (the same environment limitation
noted throughout — no compositing, so no real clicks) — it rests on the mechanism matching
exactly, not on watching it happen. Worth a real check: enter the passphrase at `/unlock`
and confirm it lands on `/dashboard` without retyping the URL. Confirmed fixed against the
live app afterward.

### LTP and Invested surfaced alongside Avg buy and Value; returns lead with ₹ (2026-08-24)

`HoldingsTable` already computed `currentPrice` per holding; it just never showed it
anywhere next to what it's compared against. Both the desktop table and the mobile card
layout now show it bracketed under Avg buy — `₹10.04 (₹10.15)` — and Invested bracketed
under Value the same way, only when `hasLivePrice` is true: when it's false, `currentPrice`
already equals `avgBuyPrice` (the valuation layer's own cost-basis fallback), so showing
that identical number twice would be redundant noise on top of the existing "cost basis"
tag, not new information. Desktop's separate "Invested" column is gone, merged into "Value"
(`Value (Invested)`, one sortable header) — the two numbers are read together anyway, and
splitting them was two columns' worth of table width for something naturally read as one.
The unused `"invested"` `SortField` case went with it.

Funds returns flipped to lead with the absolute ₹ figure, percentage secondary — both the
page-level summary stat (which already showed both, just percent-first) and each per-fund
row in the overlap section (which showed *only* a percentage before; the absolute figure is
new there, not just reordered). Confirmed live against real data on both pages, not just
read back from the diff.

Asked in passing whether fund overlap and constituents "get updated" — they do, on two
different clocks. Constituents (`FundHolding` rows) refresh via `refreshFundHoldings()`,
scraped from Groww, on the daily cron and the manual "Refresh holdings" button; a failed
scrape keeps the last-known-good rows rather than blanking them (same graceful-degradation
contract as every price provider). Overlap is not a stored value at all —
`overlapMatrix()`/`pairwiseOverlap()` (`lib/funds/analysis.ts`) compute it fresh from
whatever constituent rows exist on every single page load, so it can never itself go stale
independently of the constituents it's derived from.

### SIP execution reversal, and weekly/quarterly auto-apply (2026-08-24)

Both from TODO §1. TODO's own text said weekly/quarterly "falls out of the Transaction
model" — turned out not to be true. The real gap was narrower: `SipPlan` only ever stored
`dayOfMonth`, which has no meaning for "which day of the week," and `dueDatesBetween()` was
hardcoded to walk month by month regardless of the plan's actual `frequency`. Closed both
without touching the schema for cadence itself — no new columns, no Transaction model:

- **WEEKLY** reuses the `dayOfMonth` column as a day-of-week (0 Sun – 6 Sat, JS's own
  `getUTCDay()`, chosen so the date math never needs a translation table). The form shows an
  explicit Mon–Sun picker when Weekly is selected, not a repurposed 1–31 number input — a
  user shouldn't have to know "day of month" secretly means something else.
- **QUARTERLY** reuses `dayOfMonth` as-is (the within-month day, exactly like MONTHLY) and
  gets its phase — which three months of the year it lands in — from the plan's own
  `applyFrom` (already stored for every plan, set to today at creation, untouched by later
  edits). A plan created in March debits in March/June/September/December; one created in
  April debits in April/July/October/January. No new field: whichever month the plan was
  actually set up in becomes its phase, the same way its day-of-month already anchors the
  within-month date.
- `nextSipDate()`/`dueDatesBetween()` (`lib/sips/schema.ts`) both took a `frequency`
  parameter without changing a single line of MONTHLY's own behavior — same walk, same
  clamping, `monthQualifiesForQuarter()` just short-circuits to always-true for MONTHLY.
  26 tests now (was 14): every existing MONTHLY case unchanged, plus WEEKLY and QUARTERLY
  cases including the always-qualifies check and a short-month clamp for QUARTERLY. The one
  real mistake caught by running them rather than reading them: a QUARTERLY window test's
  own *expected* array was wrong (it excluded a date the window I'd set genuinely included) —
  worth noting since it's exactly the class of error tests exist to catch, including from
  whoever wrote them.
- `apply.ts`'s `NOT_MONTHLY` skip reason is gone; the cron and manual refresh now apply all
  three cadences through the same path, no special-casing.

**Reversal**, scoped to only the most recent, not-yet-reversed execution per plan (confirmed
before building, not assumed) — not because the math can't handle an older one in isolation,
but because `Holding.quantity`/`avgBuyPrice` are running totals, not a ledger, so "undo an
old one while newer ones sit on top of it" has no correct answer without replaying debits in
order, and there is no stored order to replay. `SipExecution` gained `reversedAt` rather than
allowing a delete: the row is still the audit trail, and it's still what the next cron run's
"last execution" cursor reads — deleting it would make the very next run re-apply the exact
debit that was just reversed.

`lib/sips/reverse.ts`'s math leans on an identity that already holds everywhere else in this
app: `avgBuyPrice = invested / quantity`, because every write path (SIP debits, top-ups)
computes the average from money in rather than backwards from a rounded unit count. To
reverse an execution: `newQuantity = quantity - unitsAdded`,
`newAvgBuyPrice = (quantity × avgBuyPrice - amountInr) / newQuantity`. Refuses outright if
`newQuantity` would go negative (the holding has fewer units than this debit added — almost
certainly hand-edited since); zeroes the average cleanly rather than dividing by zero if it
lands on exactly zero. The one honest limitation, documented in the module rather than
hidden: if the holding was directly overwritten by hand (the Edit dialog *sets* values, it
doesn't blend) after this execution applied, the invested-money identity no longer holds and
the reversal math would be wrong — the same class of gap as everywhere else pre-dating a
real transaction ledger, not a new one.

Verified past the two new test files: a throwaway instrument/bank/holding/plan/execution
(not the real account's data) exercised the actual apply-then-reverse cycle end to end
against the live database — quantity, average, and bank balance all landed back on their
exact pre-debit values, a second reversal attempt on the same execution was correctly
refused, and everything was deleted afterward. Checked live on the real account too: the
funds page's "Applied ... · Reverse" line renders correctly against real SIP data.
`tsc`, `eslint`, all 139 tests, `next build` all green.
