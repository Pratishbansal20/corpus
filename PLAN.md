# Personal Finance Hub: Plan & Status (v3)

_Last updated 2026-08-05. This file is the source of truth for what's built vs. what's next._
_Mirrored from the Claude Code plan; kept in-repo so it's openable on GitHub / the Claude app._

## Context
A **complete personal finance hub** for one user (the owner): investments (Indian stocks,
mutual funds, US stocks) + bank balances + credit cards + SIPs + credit score, unified into a
single **net-worth** view, plus a Tickertape-style **mutual-fund overlap/sector analysis**.
Holds sensitive data, so "nobody but me" security is first-class.
**Live:** https://finance-manager-17xp.vercel.app

### Locked decisions
- Net worth = assets (investments + bank + other assets) − liabilities (credit-card outstanding).
- Cards: **last 4 only**, no PAN/CVV ever. Bank full acct number/IFSC optional + AES-encrypted.
- Access: **email allowlist** (`OWNER_EMAIL`) + **app passphrase** gate (`/unlock`).
- Base currency **INR**. Hosting: **Vercel, private + hardened**.

### Stack (as built)
- Next.js 16 (App Router) + TS monolith · PostgreSQL (Neon) + **Prisma 7** (pg adapter,
  `prisma.config.ts`, client → `src/generated/prisma`, gitignored).
- Auth.js v5 (Google, **database sessions**) · Tailwind v4 + shadcn (base-nova/Base UI) ·
  **recharts 3.9** · **vitest** (74 tests) · dark-first · money always `Decimal`.
- **Env vars**: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `OWNER_EMAIL`,
  `ENCRYPTION_KEY` (32-byte b64), `PRICE_STALE_HOURS`, `CRON_SECRET`.

---

## ✅ Delivered (all verified: `tsc` clean, `next build` green, 74 tests pass)

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
NAV 93.3575, 367.787805 units, ₹81.568773 average, ₹30,000 invested, HDFC down exactly ₹25,000).
Real positions were never touched.

Note: top-ups still only mutate the holding. They record no date, so they remain invisible to
XIRR. They are the obvious first writer to the `Transaction` model in Phase 2.

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
  NAV against a quantity of 1 and shown a ₹15,323 fund as ₹10. Converted all seven to real units
  and real average NAV, reconciled to the figures on 31 Jul 2026 (invested ₹53,397, current
  ₹56,897, returns ₹3,500). Values are now self-updating and survived a live refresh unchanged.
- **Added a stale-units nudge**: `countStaleMutualFunds()` flags any fund whose units have not
  changed in 15 days, since NAVs move on their own but a lump-sum purchase has to be entered.

Note: XIRR still cannot be computed (see Phase 2). The 13.41% figure comes from the broker.

### ✅ Phase 1.5: SIP auto-apply to holdings (done 2026-08-02)
SIP debits now update holdings. Previously a `SipPlan` stored only the schedule and nothing added
the purchased units to the `Holding`, so after every debit the app understated units and invested
until the position was edited by hand. That is why the numbers had drifted about ₹7,000 below
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
- [x] Surfaced on `/holdings` and `/funds`: "Applied 1 Jul at NAV ₹9.89 · 303.1987 units ·
      ₹3,000 from HDFC Bank ••4583", showing both dates whenever the allotment shifted, and each
      SIP row carries "· from HDFC Bank ••4583" so the linked account is visible without opening
      the dialog.
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
      - All four plans are linked to HDFC Bank ••4583 (₹7,000/month against ₹36,106.50).

Verified end to end against the live database: two missed debits (1 Jun, 1 Jul) were caught up in
order at their real published NAVs, quantity and invested matched a hand calculation to the paisa,
HDFC fell by exactly ₹6,000 while invested rose by exactly ₹6,000, re-running applied nothing and
did not double-debit the bank, and the test state was then restored. The current live state is the
day-1 SIP correctly *waiting*, because 1 Aug 2026 was a Saturday and Monday's NAV is not out yet.

---

## 🔲 Remaining backlog

Ordered. Each phase leaves the app deployable.

### Phase 1: Brand finish
- [ ] **Logo pass**: the current mark works but has only been checked at 22px and 32px. Test at
      16px (browser tab), 180px (`apple-icon.png`), and on a light background. Add `apple-icon`
      and a static `opengraph-image` so shared links render properly. Consider a lockup variant
      with the wordmark for the README.
- [ ] **Landing hero animation: the assembly.** Replace the current converging-arcs SVG with pie
      slices that fly in and snap together into a complete donut.
      - 5 donut segments, one per source (Groww, Paytm Money, INDmoney, HDFC, ICICI), each in a
        chart colour, drawn as SVG arc paths around a shared centre.
      - Each slice starts pushed out along its own radial vector, rotated a few degrees, at zero
        opacity. It flies inward fast on a sharp ease-out (roughly 450ms), staggered about 80ms
        apart, and lands with a small overshoot so it reads as a snap rather than a fade.
      - On the final slice landing, fire the impact: a brass ring scales outward from the centre
        and fades, the whole graphic gets a one-frame brightness lift, and the net worth number
        starts counting up. That is the "thunder" beat.
      - Slice labels fade in around the ring afterwards, so the composition reads before the text.
      - Implementation: CSS keyframes with a per-slice `--delay` and `--angle` custom property,
        the same pattern as the existing `.rise` and `.draw` utilities. No animation library needed.
      - This is on-brand by construction: the logo is a segmented ring, so the hero assembling a
        ring from parts is the mark being built in front of you.
      - Must render fully assembled and static under `prefers-reduced-motion`.
- [ ] **Loading and empty states**: skeletons for the Overview tiles, tables and charts. Refresh
      the remaining empty states to the new system.

### Phase 2: XIRR (needs a schema change first)
**Blocker found 2026-07-07:** nothing in the database stores *when* an investment was made.
`Holding` has `quantity` and `avgBuyPrice` only, and `createdAt` is when the row was typed into
the app, not when the money was invested. XIRR is a function of cash-flow *dates*, so it cannot
be computed from the current schema at all. Two ways forward:

- **Option A (recommended): add a `Transaction` model.** `userId`, `instrumentId`, `type`
  (BUY/SELL/DIVIDEND), `quantity`, `pricePerUnit`, `date`, `source`. Derive `quantity` and
  `avgBuyPrice` on `Holding` from the transactions rather than storing them by hand. This gives
  true XIRR, and it is the same table CSV import and a future ledger both need, so the work is
  not XIRR-specific.
- **Option B: add a single `purchaseDate` to `Holding`.** Much cheaper, but it only supports an
  approximate, single-cash-flow return per position and it is a dead end for CSV import.

Then:
- [ ] `lib/portfolio/xirr.ts`: Newton-Raphson solver with a bisection fallback for the cases where
      Newton diverges, plus unit tests against a known-answer fixture (compare with a spreadsheet
      XIRR).
- [ ] Show XIRR per holding and for the whole portfolio, next to the existing absolute return.
- [ ] Backfill: a Settings screen to attach dates to existing positions, since 36 holdings already
      exist without them.

### Phase 3: Data in and out
- [ ] **CSV import** (`/import` is still a placeholder): upload, validate, preview, then commit
      with idempotent upserts so re-uploading the same file never doubles a position. Maps to the
      `Transaction` model from Phase 2.
- [ ] **PDF export**: a Download button producing (a) investments (holdings, allocation, returns)
      and (b) the full analysis (net worth, app-wise, fund overlap and sector exposure, credit).
      Either `@react-pdf/renderer` or a print route rendered to PDF. Must respect masking, so no
      full account numbers reach the file.

### Phase 4: It reaches you
- [ ] **PWA**: `manifest.webmanifest`, maskable icons, standalone display, a light service worker
      for the app shell, so Corpus installs to the home screen and opens without browser chrome.
- [ ] **Reminders**: card due dates and SIP debits over WhatsApp, SMS or email, driven by the
      existing daily cron. Needs a Twilio or SendGrid account.

### Phase 5: Depth
- [ ] Transactions and dividend tracking (falls out of Phase 2), watchlist, goal tracking
      (target net worth with a progress read), capital gains and tax estimate, benchmark
      comparison against NIFTY and the S&P 500, CAS PDF import.
- [ ] Backup and encrypted export, TOTP as a second factor on top of the passphrase.
- [ ] Error monitoring (Sentry), and set the Vercel function region to `sin1` to sit next to Neon.

---

## Verification approach
- `npm test` + `tsc --noEmit` + `npm run build` green before deploy.
- Authenticated pages cannot be screenshotted headlessly (the session cookie is httpOnly), so
  verify them by seeding a temporary pre-unlocked `Session` row and curling with that cookie,
  then deleting the row. For visuals, a temporary public page rendering the real components with
  sample data works well.
- DB spot-checks via a throwaway `node` + Prisma script.

## Known gotchas (learned the hard way)
- **Turbopack caches CSS aggressively.** After editing `globals.css` tokens, a stale `.next` will
  keep serving the old palette and silently drop new rules. If styles look wrong, `rm -rf .next`
  and restart before debugging the CSS itself.
- **Base UI + RSC:** do not pass JSX trigger elements from a Server Component into a Client
  component and `cloneElement` them ("Element type is invalid"). Client components build their own
  triggers. Base UI `Button` uses `render`, not `asChild`; pass `nativeButton={false}` for a link.
- **Prisma schema changes need a dev-server restart** (the client singleton caches in memory).
- **Groww is unofficial and scraped**, so it can break if their page changes. The graceful refresh
  keeps the last good holdings when a fetch fails.
- **A published NAV series doubles as a business-day calendar.** AMFI publishes only on settlement
  days, so a missing date means a weekend or a holiday. Any "what price applied on date X" question
  should walk that series rather than reach for a hardcoded holiday list.
- **Outbound fetches in the daily cron need retries.** A single cold DNS/TLS handshake failed about
  one run in three from the Next server while succeeding instantly from curl.
- **No em dashes**, anywhere, in copy or comments.
