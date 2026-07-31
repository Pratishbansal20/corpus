import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/wordmark";
import { CountUp } from "@/components/landing/count-up";

export const metadata: Metadata = {
  title: "Corpus: every account, one number",
  description:
    "Stocks, mutual funds, bank balances and cards live in different apps. Corpus pulls them into one view: what you are worth today, what you actually own, and what is due next.",
};

// Sample figures. Nothing on this page is anyone's real position.
const SOURCES = [
  { name: "Groww", holds: "Stocks · Mutual funds" },
  { name: "Paytm Money", holds: "Stocks" },
  { name: "INDmoney", holds: "US stocks" },
  { name: "HDFC Bank", holds: "Savings" },
  { name: "ICICI Bank", holds: "Savings · FD" },
];

export default async function LandingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user);

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="border-border/70 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
          <Wordmark showTag />
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href={signedIn ? "/dashboard" : "/login"} />}
          >
            {signedIn ? "Open Corpus" : "Get started"}
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-5 pt-12 pb-16 md:px-8 md:pt-16 md:pb-24">
          <p className="eyebrow rise">Personal finance</p>
          <h1 className="font-display rise mt-4 max-w-[16ch] text-[clamp(2.75rem,8vw,5rem)] leading-[0.94] font-semibold tracking-[-0.04em]">
            Every account.
            <br />
            One number.
          </h1>
          <p
            className="text-muted-foreground rise mt-6 max-w-[52ch] text-base leading-relaxed text-balance md:text-lg"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            Your stocks, mutual funds, bank balances and cards all live in
            different apps. Corpus pulls them into one view: what you are worth
            today, what you actually own, and what is due next.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center gap-x-4 gap-y-3"
            style={{ "--delay": "160ms" } as React.CSSProperties}
          >
            <Button
              nativeButton={false}
              render={<Link href={signedIn ? "/dashboard" : "/login"} />}
              className="gap-2"
            >
              {signedIn ? "Open Corpus" : "Get started"}
              <ArrowRight className="size-4" />
            </Button>
            <p className="text-muted-foreground text-xs">
              Free to use. Nothing to install.
            </p>
          </div>

          {/* The thesis, drawn: many sources gathered into one figure. */}
          <div className="mt-12 md:mt-14">
            <GatherGraphic />
          </div>
        </section>

        {/* ── What it does ──────────────────────────────────────────────── */}
        <section className="border-border border-t">
          <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
            <Feature
              label="Fund overlap"
              title="You own the same stock four times"
              body="Buy a second flexi cap and you may just be buying the first one again. Corpus reads what each fund actually holds, adds up your real position in every company, and shows you which funds are quietly copies of each other."
            >
              <OverlapVisual />
            </Feature>

            <Feature
              label="Live prices"
              title="Priced from the source, every morning"
              body="Mutual fund NAVs, equity prices and the USD rate refresh on their own, and each day's net worth is saved so you can watch the line move. If a source goes down, the last good price holds. The number never quietly breaks."
              reverse
            >
              <PricesVisual />
            </Feature>

            <Feature
              label="Calendar"
              title="Never miss a due date again"
              body="SIP debits and credit-card dues land on one timeline, so the money leaving your account next week is never a surprise. Balances you have not touched in a fortnight get flagged before they go stale."
            >
              <CalendarVisual />
            </Feature>
          </div>
        </section>

        {/* ── Security ──────────────────────────────────────────────────── */}
        <section className="border-border border-t">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-28">
            <div>
              <p className="eyebrow">Security</p>
              <h2 className="font-display mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
                It holds your account details, so it is built to keep them.
              </h2>
            </div>
            <ul className="flex flex-col gap-4">
              {[
                {
                  t: "Card numbers are never stored",
                  d: "Only the last four digits, the issuer and the due date. Enough to recognise a card, useless to anyone else.",
                },
                {
                  t: "Encrypted where it counts",
                  d: "Bank account numbers and IFSC codes are stored with AES-256-GCM. Lists only ever show a masked ·· 1234.",
                },
                {
                  t: "A passphrase on top of sign-in",
                  d: "Google gets you to the door. A separate passphrase opens the session, so a borrowed phone is never a borrowed portfolio.",
                },
                {
                  t: "Read-only by nature",
                  d: "Corpus records what you own. It never holds your money, never moves it, and cannot place a trade.",
                },
              ].map((item) => (
                <li key={item.t} className="flex gap-3.5">
                  <span className="bg-primary/10 text-primary mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full">
                    <Check className="size-3.5" />
                  </span>
                  <span>
                    <span className="text-sm font-medium">{item.t}</span>
                    <span className="text-muted-foreground block text-sm leading-relaxed">
                      {item.d}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Close ─────────────────────────────────────────────────────── */}
        <section className="border-border border-t">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-24 text-center md:px-8">
            <h2 className="font-display max-w-[18ch] text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.03em] text-balance">
              Stop opening five apps to answer one question.
            </h2>
            <Button
              nativeButton={false}
              render={<Link href={signedIn ? "/dashboard" : "/login"} />}
              className="gap-2"
            >
              {signedIn ? "Open Corpus" : "Get started"}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs sm:flex-row md:px-8">
          <Wordmark />
          <p>A personal project. Figures shown here are samples, not holdings.</p>
        </div>
      </footer>
    </div>
  );
}

/* ── The signature graphic ──────────────────────────────────────────────── */

function GatherGraphic() {
  return (
    <div className="border-border bg-card/60 rounded-2xl border p-6 md:p-10">
      <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,1fr)] md:gap-4">
        {/* Sources */}
        <ul className="flex flex-col gap-2.5">
          {SOURCES.map((s, i) => (
            <li
              key={s.name}
              className="border-border bg-background/60 rise flex items-center gap-3 rounded-lg border px-3.5 py-2.5"
              style={{ "--delay": `${240 + i * 90}ms` } as React.CSSProperties}
            >
              <span className="bg-primary/60 size-1.5 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {s.name}
              </span>
              <span className="text-muted-foreground hidden truncate text-xs sm:block">
                {s.holds}
              </span>
            </li>
          ))}
        </ul>

        {/* The gather: five lines resolving into one. Decorative on mobile,
            where the stacked layout already reads top-to-bottom. */}
        <svg
          viewBox="0 0 100 220"
          aria-hidden
          className="hidden h-[13.5rem] w-full md:block"
          preserveAspectRatio="none"
        >
          {[18, 66, 112, 158, 204].map((y, i) => (
            <path
              key={y}
              d={`M0 ${y} C 45 ${y}, 55 110, 100 110`}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="1"
              strokeOpacity="0.42"
              className="draw"
              style={{ "--delay": `${420 + i * 90}ms` } as React.CSSProperties}
            />
          ))}
        </svg>

        {/* The total */}
        <div
          className="rise md:pl-2"
          style={{ "--delay": "820ms" } as React.CSSProperties}
        >
          <p className="eyebrow">Net worth</p>
          <p className="font-display mt-2 text-[clamp(2rem,5vw,2.75rem)] leading-none font-semibold tracking-[-0.035em]">
            <CountUp to={1248900} delayMs={900} />
          </p>
          <div className="mt-4 flex h-2 w-full gap-[3px] overflow-hidden rounded-full">
            <div
              className="h-full rounded-l-full"
              style={{ width: "57%", background: "var(--chart-1)" }}
            />
            <div
              className="h-full"
              style={{ width: "31%", background: "var(--chart-2)" }}
            />
            <div
              className="h-full rounded-r-full"
              style={{ width: "12%", background: "var(--chart-4)" }}
            />
          </div>
          <p className="text-muted-foreground mt-2.5 text-xs">
            Investments · Bank · Other assets
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Feature scaffold ───────────────────────────────────────────────────── */

function Feature({
  label,
  title,
  body,
  reverse,
  children,
}: {
  label: string;
  title: string;
  body: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border grid items-center gap-8 py-16 not-first:border-t md:grid-cols-2 md:gap-14 md:py-24">
      <div className={reverse ? "md:order-2" : undefined}>
        <p className="eyebrow">{label}</p>
        <h2 className="font-display mt-3 text-[clamp(1.625rem,3.2vw,2.25rem)] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
          {title}
        </h2>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed md:text-base">
          {body}
        </p>
      </div>
      <div className={reverse ? "md:order-1" : undefined}>{children}</div>
    </div>
  );
}

/* ── Feature visuals (samples, drawn in CSS) ────────────────────────────── */

function OverlapVisual() {
  const shared = ["HDFC Bank", "ICICI Bank", "Bharti Airtel", "Reliance"];
  return (
    <div className="border-border bg-card/60 rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Flexi Cap A</span>
        <span className="text-muted-foreground text-xs">overlap</span>
        <span className="text-sm font-medium">Flexi Cap B</span>
      </div>
      <div className="my-4 flex items-center gap-2">
        <div className="bg-chart-1/70 h-2 flex-1 rounded-full" />
        <span className="num text-primary shrink-0 text-sm font-medium">
          36%
        </span>
        <div className="bg-chart-2/70 h-2 flex-1 rounded-full" />
      </div>
      <p className="text-muted-foreground mb-3 text-xs">
        29 companies held by both
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {shared.map((s) => (
          <li
            key={s}
            className="border-border text-muted-foreground rounded-md border px-2 py-1 text-xs"
          >
            {s}
          </li>
        ))}
        <li className="text-muted-foreground/70 px-2 py-1 text-xs">+25 more</li>
      </ul>
    </div>
  );
}

function PricesVisual() {
  const rows = [
    { src: "AMFI", what: "Mutual fund NAV", ok: true },
    { src: "Exchange", what: "Equity last price", ok: true },
    { src: "Frankfurter", what: "USD → INR", ok: true },
  ];
  return (
    <div className="border-border bg-card/60 divide-border divide-y rounded-xl border">
      {rows.map((r) => (
        <div key={r.src} className="flex items-center gap-3 px-5 py-3.5">
          <span className="bg-gain size-1.5 shrink-0 rounded-full" />
          <span className="text-sm font-medium">{r.src}</span>
          <span className="text-muted-foreground flex-1 truncate text-xs">
            {r.what}
          </span>
          <span className="num text-muted-foreground text-xs">today</span>
        </div>
      ))}
      <p className="text-muted-foreground px-5 py-3 text-xs">
        Cached. A failed fetch keeps the previous price.
      </p>
    </div>
  );
}

function CalendarVisual() {
  const rows = [
    { name: "Flexi Cap SIP", kind: "SIP", when: "5 Aug", amt: "₹5,000" },
    { name: "Midcap SIP", kind: "SIP", when: "7 Aug", amt: "₹3,000" },
    { name: "HDFC Regalia", kind: "Card due", when: "12 Aug", amt: "₹18,400" },
  ];
  return (
    <div className="border-border bg-card/60 divide-border divide-y rounded-xl border">
      {rows.map((r) => (
        <div
          key={r.name}
          className="flex items-center justify-between gap-3 px-5 py-3.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.name}</p>
            <p className="text-muted-foreground text-xs">
              {r.kind} · {r.when}
            </p>
          </div>
          <span
            className={`num shrink-0 text-sm ${r.kind === "Card due" ? "text-loss" : ""}`}
          >
            {r.amt}
          </span>
        </div>
      ))}
    </div>
  );
}
