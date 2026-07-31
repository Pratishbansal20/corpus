# Personal Finance Hub: Plan & Status (v3)

_Last updated 2026-07-07. This file is the source of truth for what's built vs. what's next._
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
  **recharts 3.9** · **vitest** (14 tests) · dark-first · money always `Decimal`.
- **Env vars**: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `OWNER_EMAIL`,
  `ENCRYPTION_KEY` (32-byte b64), `PRICE_STALE_HOURS`, `CRON_SECRET`.

---

## ✅ Delivered (all verified: `tsc` clean, `next build` green, 14 tests pass)

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
- MF holdings are **scraped from Groww**, not mfdata.in/manual-seed (mfapi.in = NAV-only; mfdata.in down).
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
- **No em dashes**, anywhere, in copy or comments.
