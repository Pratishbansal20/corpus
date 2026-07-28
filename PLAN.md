# Personal Finance Hub — Plan & Status (v3)

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

- [x] **M1 Setup** — scaffold, shadcn, dark theme, Prisma+Neon, app shell (sidebar/topbar/mobile nav).
- [x] **M2 Auth** — Google OAuth, DB sessions, `/login`, protected `(dashboard)`, user menu + sign-out.
- [x] **M3 Holdings CRUD** — manual add/edit/delete, idempotent instrument upsert, `source` tagging.
- [x] **M4 Finance model + Net Worth** — `BankAccount`, `CreditCard`, `SipPlan`, `CreditScore`,
      `ManualAsset`, `Session.unlockedAt`; net-worth aggregation (`lib/networth/compute.ts`);
      Net-Worth **Overview** home; **Accounts** page; **SIP tracker**; credit score in Settings;
      **app-wise consolidation** ("where it lives").
- [x] **M5 Security** — allowlist in `signIn` + `requireUser`; passphrase gate `requireUnlocked()`
      + `/unlock` (scrypt, `UserSecurity`); **AES-256-GCM** field encryption (`lib/crypto/encryption.ts`,
      tested); secure cookies; masked `•• 1234` in UI.
- [x] **M6 Cards + bank details** — CreditCard CRUD, due-date "Due in Nd" flags, utilization;
      optional encrypted full acct number/IFSC on bank accounts.
- [x] **M7 Pricing pipeline** — `PriceProvider` abstraction (AMFI NAV, Yahoo equity, Frankfurter FX)
      with caching + **graceful degradation**; manual Refresh; prices in `Price`/`FxRate`.
- [x] **M8 Charts + history** — recharts allocation donuts (asset class / country) + **net-worth
      trend**; `PortfolioSnapshot` extended; daily **Vercel Cron** (`/api/cron/refresh`, `vercel.json`,
      03:30 UTC) refreshes prices + writes snapshot; snapshot also written on manual refresh.
- [x] **M11 Mutual-Funds analysis** (`/funds`) — overlap matrix (Σ min-weight, name-normalized),
      **true company exposure** (Σ fund₹×stock-weight), sector donut, per-fund **top-10 + "Show all"**.
      Real constituents via **`GrowwHoldingsProvider`** (scrapes Groww page-embedded portfolio JSON)
      with pinned slugs; `refreshFundHoldings()` replaces a fund's rows **only on a successful scrape
      (atomic) — keeps previous data if Groww fails**; "Refresh holdings" button + in daily cron.
      All 7 funds real-sourced (26–251 holdings, 90–99% coverage).
- [x] **Data fix** — QQQ→**QQQM** (Invesco NASDAQ-100), $293.42; P/L now +4.4% (was a bogus +153%).

### Corrections vs earlier plan (now reality)
- MF holdings are **scraped from Groww**, not mfdata.in/manual-seed (mfapi.in = NAV-only; mfdata.in down).
- Provider is `GrowwHoldingsProvider`, not the planned `MfHoldingsProvider(mfdata)`.

---

## 🔲 Remaining backlog (TODO)

**P1 — Ship it**
- [x] **Deployed to Vercel (2026-07-07)** — live at https://finance-manager-17xp.vercel.app.
      Health-checked (routes 307→login, OAuth prod callback, cron 401-protected, HSTS). Same Neon DB.
      Owner checks: confirm login+data on prod; Vercel → Settings → Cron Jobs shows `/api/cron/refresh`.
- [x] **Committed + pushed** (deploy is from `main`).

**P2 — Mobile & polish (make it feel premium on a phone)**
- [x] **Mobile UI pass (2026-07-07)** — safe-area-inset-bottom on the fixed bottom nav + main content
      (notched iPhones); bumped icon-sm→icon touch targets in shared dialog triggers; **holdings table**
      now has a real mobile card-list view (`hidden md:block` table / `md:hidden` cards + native sort
      select); **funds overlap matrix** — fixed `w-full` bug that defeated horizontal scroll on many
      funds, switched to `w-max` + `min-w-14` + a scroll hint. Verified tsc/build/tests green + curled
      real authenticated pages via a temp seeded session (cleaned up after).
- [ ] **PWA** — `manifest.webmanifest` (name, theme color, icons 192/512, standalone), app icons,
      lightweight service worker for install + offline app-shell; "Add to Home Screen".
- [ ] **Landing page** — a public `/` (or `/welcome`) before login: product intro, screenshots, "Sign in"
      CTA (currently `/` → `/dashboard` → `/login`).
- [ ] **Loading & motion** — skeleton loaders (tiles, tables, charts) + subtle Framer Motion
      (number count-ups, staggered fade-in). Refine empty states.

**P3 — Features**
- [ ] **Reminders** — WhatsApp/SMS/email for card **due dates** + **SIP dates** (Twilio/SendGrid),
      driven by the daily cron.
- [ ] **XIRR** — annualized returns (Newton-Raphson) + a known-answer unit test.
- [ ] **CSV import** — `/import` is a placeholder; bulk-import from Groww/INDmoney CSV, idempotent + preview.
- [ ] **PDF export / download** — a "Download" button to export a report as PDF: (a) **investments**
      (holdings + allocation + P/L) and/or (b) **full analysis** (net worth, app-wise, MF overlap/sector/
      company exposure, credit). Options: `@react-pdf/renderer` or Puppeteer→PDF of a print route, or
      client `window.print()` + print stylesheet. Branded + INR-formatted; **respect masking** (no full
      acct numbers in the export).

**P4 — Nice-to-have / stretch**
- [ ] Transactions/ledger & dividend tracking · watchlist · goal tracking · capital-gains/tax estimate ·
      benchmark comparison (NIFTY/S&P 500) · CAS PDF import.
- [ ] Backup/export (encrypted) · TOTP 2FA on top of passphrase · error monitoring (Sentry).
- [ ] Fallback MF source (mfdata.in when it returns) behind the same provider seam.

---

## Verification approach
- `npm test` + `tsc --noEmit` + `npm run build` green before deploy.
- Authenticated pages can't be screenshotted headlessly (httpOnly cookie + a 2nd `next dev` can't share
  the `.next` lock) → verify via build + curl for status/markers, or a temp public page.
- DB spot-checks via a throwaway `node` + Prisma script (seed a Session to curl authed pages).

## Known gotchas (learned the hard way)
- **Base UI + RSC:** don't pass JSX trigger elements Server→Client and `cloneElement` them
  ("Element type is invalid"); client components build their own triggers. Base UI `Button` uses
  `render` (not `asChild`); pass `nativeButton={false}` for `<a>`/Link.
- **Prisma schema changes need a dev-server restart** (client singleton caches in memory).
- **Groww is unofficial/scraped** — can break if their page changes; graceful degradation covers it.
