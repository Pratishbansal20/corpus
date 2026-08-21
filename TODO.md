# Corpus: TODO

_Last updated 2026-08-21. Ordered by what unblocks the most. `PLAN.md` holds the
history of what is already built and why._

> **Working agreement:** nothing here gets executed without agreeing the approach
> first. Pick an item, we settle how to do it, then it gets built.

---

## 0. The one blocker

**`Transaction` model.** Nothing in the database records *when* money was invested.
`Holding` stores only `quantity` and `avgBuyPrice`, and `createdAt` is when the row was
typed in. Four separate things are stuck behind this:

- XIRR is a function of cash-flow dates, so it cannot be computed at all today
- CSV import needs somewhere to put rows
- Top-ups and SIP executions currently mutate the holding and record no date
- Dividend tracking and capital-gains estimates have nowhere to live

`userId, instrumentId, type (BUY/SELL/DIVIDEND), quantity, pricePerUnit, date, source`,
with `Holding.quantity` and `avgBuyPrice` derived from it rather than stored by hand.
Do not start XIRR before this lands.

---

## 1. Correctness and safety

Cheap, and each one closes a hole that has already cost us something.

| Item | Why |
|---|---|
| **CI on pull requests** | `tsc`, `vitest` and `next build` only ever run on my machine. Nothing stops a broken commit reaching `main` and deploying. |
| **Reverse a SIP execution** | A bounced mandate means the app bought units reality did not. `SipExecution` records enough to undo it, but there is no way to. |
| **Weekly and quarterly SIPs** | Only `MONTHLY` auto-applies. The others store no anchor date, so monthly dates would over-buy them. Falls out of the `Transaction` model. |

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

| Item | Depends on |
|---|---|
| **XIRR**, per holding and portfolio-wide, with a backfill screen for existing positions | `Transaction` |
| **CSV import** (`/import` is still a placeholder): upload, validate, preview, idempotent commit | `Transaction` |
| **Dividend tracking** | `Transaction` |
| **Capital gains and tax estimate** | `Transaction`, corporate actions |
| **Benchmark comparison** against NIFTY and the S&P 500 | backfill |
| **Goal tracking**: target net worth with a progress read | |
| **Watchlist** | |

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

## 4. It reaches you

- **PWA**: `manifest.webmanifest`, maskable icons, standalone display, light service worker
  for the app shell, so Corpus installs to the home screen.
- **Reminders**: card due dates and SIP debits over WhatsApp, SMS or email, driven by the
  existing daily cron. Needs a Twilio or SendGrid account.

## 5. Brand finish

- **Landing hero animation**: replace the converging arcs with pie slices that fly in and
  snap into a complete donut, then a brass impact ring and the net worth counting up.
  Must render assembled and static under `prefers-reduced-motion`.

## 6. Housekeeping

- **Pre-existing lint errors** (11, none from recent work): two `any` in `holdings-table`,
  seven `react-hooks/static-components` in the same file, a `setState`-in-effect in the
  animated counter, an `any` in `seed-portfolio`, an unused import in `cards/queries`.
- **Error monitoring** (Sentry), and set the Vercel function region to `sin1` to sit next
  to Neon.
- **Backup and encrypted export**; **TOTP** as a second factor on top of the passphrase.

---

## Settled, not to be reopened

- **TMCV cost basis after the demerger.** Checked against the Paytm Money app: invested and
  returns match exactly. The app agrees with the broker, so there is nothing to apportion.
- **No stack migration.** 1,586 rows and 10 MB. Every real problem so far has been data
  quality, not technology, and none of them would have been prevented by a different
  database, ORM or framework.
