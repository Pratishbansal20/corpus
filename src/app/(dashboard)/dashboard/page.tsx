import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPortfolio } from "@/lib/holdings/queries";
import {
  getBankAccounts,
  getManualAssets,
  sumBalances,
  sumAssetValues,
} from "@/lib/accounts/queries";
import {
  getCreditCards,
  sumOutstanding,
  dueCards,
  resolveDueDate,
} from "@/lib/cards/queries";
import {
  getLatestCreditScore,
  scoreBand,
  CREDIT_BUREAU_LABELS,
} from "@/lib/credit/queries";
import { getSipPlans, monthlySipTotal } from "@/lib/sips/queries";
import { consolidateBySource } from "@/lib/holdings/consolidation";
import { computeNetWorth } from "@/lib/networth/compute";
import { getNetWorthHistory } from "@/lib/networth/snapshot";
import {
  allocationByAssetClass,
  allocationByCountry,
} from "@/lib/portfolio/allocation";
import { formatInr, formatPct, formatSignedInr } from "@/lib/money";
import { NetWorthTrend } from "@/components/charts/net-worth-trend";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { CompositionLine } from "@/components/charts/composition-line";
import { SectionHeading } from "@/components/layout/section-heading";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
});

function pnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [portfolio, banks, assets, cards, creditScore, sips, history] =
    await Promise.all([
      getUserPortfolio(user.id),
      getBankAccounts(user.id),
      getManualAssets(user.id),
      getCreditCards(user.id),
      getLatestCreditScore(user.id),
      getSipPlans(user.id),
      getNetWorthHistory(user.id),
    ]);

  const bankInr = sumBalances(banks);
  const otherAssetsInr = sumAssetValues(assets);
  const cardOutstandingInr = sumOutstanding(cards);
  const investmentsInr = portfolio.summary.totalValueInr;

  const nw = computeNetWorth({
    investmentsInr,
    bankInr,
    otherAssetsInr,
    cardOutstandingInr,
  });

  const consolidation = consolidateBySource(portfolio.holdings);
  const allocByClass = allocationByAssetClass(portfolio.holdings);
  const allocByCountry = allocationByCountry(portfolio.holdings);
  const hasInvestments = portfolio.holdings.length > 0;
  const monthlySip = monthlySipTotal(sips);

  // Change since the previous daily snapshot: the only honest "movement"
  // figure we have until more history accrues.
  const changeInr =
    history.length >= 2
      ? history[history.length - 1].netWorthInr -
        history[history.length - 2].netWorthInr
      : null;

  // One timeline of money about to leave the account, whatever the reason.
  const upcoming = [
    ...sips
      .filter((s) => s.active)
      .map((s) => ({
        id: `sip-${s.id}`,
        kind: "SIP" as const,
        name: s.fundName,
        date: s.nextDate,
        amount: s.amountInr,
      })),
    ...dueCards(cards).map((c) => ({
      id: `card-${c.id}`,
      kind: "Card due" as const,
      name: c.nickname ?? c.issuer,
      date: resolveDueDate(c),
      amount: c.currentOutstanding,
    })),
  ]
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0))
    .slice(0, 6);

  // Stale-data nudges: a balance you typed six weeks ago isn't a balance.
  const STALE_DAYS = 15;
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - STALE_DAYS);

  const reminders: { id: string; message: string; href: string }[] = [];
  const staleBanks = banks.filter((b) => new Date(b.asOf) < staleThreshold);
  if (staleBanks.length > 0) {
    reminders.push({
      id: "banks",
      message: `${staleBanks.length} bank balance${staleBanks.length > 1 ? "s haven't" : " hasn't"} been updated in ${STALE_DAYS} days.`,
      href: "/accounts",
    });
  }
  const staleAssets = assets.filter((a) => new Date(a.asOf) < staleThreshold);
  if (staleAssets.length > 0) {
    reminders.push({
      id: "assets",
      message: `${staleAssets.length} asset value${staleAssets.length > 1 ? "s haven't" : " hasn't"} been updated in ${STALE_DAYS} days.`,
      href: "/accounts",
    });
  }
  if (creditScore && new Date(creditScore.asOf) < staleThreshold) {
    reminders.push({
      id: "credit",
      message: `Your credit score is more than ${STALE_DAYS} days old.`,
      href: "/settings",
    });
  }

  const everythingEmpty =
    nw.totalAssetsInr === 0 && cardOutstandingInr === 0 && !creditScore;

  if (everythingEmpty) return <OverviewEmpty name={user.name} />;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      {/* Hero: the number, and where it comes from, on one rule. */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <p className="eyebrow">Net worth</p>
            <p className="font-display mt-2 text-[clamp(2.75rem,8vw,4.25rem)] leading-[0.95] font-semibold tracking-[-0.035em] tabular-nums">
              {formatInr(nw.netWorthInr)}
            </p>
          </div>
          {changeInr !== null && (
            <p className={`num text-sm ${pnlClass(changeInr)}`}>
              {formatSignedInr(changeInr)}{" "}
              <span className="text-muted-foreground">since yesterday</span>
            </p>
          )}
        </div>

        <CompositionLine
          segments={[
            { label: "Investments", value: investmentsInr },
            { label: "Bank", value: bankInr },
            { label: "Other assets", value: otherAssetsInr },
          ]}
          liabilitiesInr={cardOutstandingInr}
          liabilitiesLabel="Card outstanding"
        />
      </section>

      {reminders.length > 0 && (
        <div className="flex flex-col gap-2">
          {reminders.map((r) => (
            <Link
              key={r.id}
              href={r.href}
              className="border-primary/25 bg-primary/[0.06] text-primary/90 hover:bg-primary/[0.1] flex items-center justify-between gap-4 rounded-lg border px-4 py-2.5 text-xs transition-colors"
            >
              <span>{r.message}</span>
              <span className="flex shrink-0 items-center gap-1 font-medium">
                Update <ArrowUpRight className="size-3.5" />
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Quiet stat rail: supporting figures, deliberately not five more cards. */}
      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 sm:grid-cols-4">
        <Stat label="Invested" value={formatInr(portfolio.summary.investedInr)} />
        <Stat
          label="Returns"
          value={formatSignedInr(portfolio.summary.pnlInr)}
          sub={formatPct(portfolio.summary.pnlPct)}
          tone={pnlClass(portfolio.summary.pnlInr)}
        />
        <Stat
          label="Monthly SIP"
          value={monthlySip > 0 ? formatInr(monthlySip) : "Not set"}
          sub={monthlySip > 0 ? `${sips.filter((s) => s.active).length} active` : undefined}
        />
        <CreditStat score={creditScore} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading
          title="Net worth over time"
          hint={
            history.length >= 2
              ? "Recorded on each refresh"
              : "Builds as you refresh"
          }
        />
        <Card>
          <CardContent>
            {history.length >= 2 ? (
              <NetWorthTrend data={history} />
            ) : (
              <div className="border-border text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-balance">
                Two days of history draws the line. Refresh prices to record
                today.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {hasInvestments && (
        <section className="flex flex-col gap-4">
          <SectionHeading title="Allocation" hint="Investments only" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>By asset class</CardTitle>
                <CardDescription>How your investments split</CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationDonut
                  data={allocByClass.map((s) => ({
                    label: s.label,
                    value: s.valueInr,
                  }))}
                  centerLabel="Invested"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By country</CardTitle>
                <CardDescription>Geographic exposure</CardDescription>
              </CardHeader>
              <CardContent>
                <AllocationDonut
                  data={allocByCountry.map((s) => ({
                    label: s.label,
                    value: s.valueInr,
                  }))}
                  centerLabel="Invested"
                />
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Where it lives */}
        {consolidation.groups.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Where it lives</CardTitle>
                  <CardDescription>Investments by app</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  nativeButton={false}
                  render={<Link href="/holdings" />}
                >
                  Details <ArrowRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="divide-border flex flex-col divide-y">
              {consolidation.groups.map((g) => (
                <div
                  key={g.source}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{g.label}</div>
                    <div className="text-muted-foreground text-xs">
                      {g.count} holding{g.count > 1 ? "s" : ""} ·{" "}
                      <span className="num">{g.weightPct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-sm">{formatInr(g.valueInr)}</div>
                    <div className={`num text-xs ${pnlClass(g.pnlInr)}`}>
                      {formatPct(g.pnlPct)}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* One calendar of money on its way out. */}
        {upcoming.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Coming up</CardTitle>
              <CardDescription>SIP debits and card dues</CardDescription>
            </CardHeader>
            <CardContent className="divide-border flex flex-col divide-y">
              {upcoming.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{u.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {u.kind}
                      {u.date ? ` · ${dateFmt.format(u.date)}` : ""}
                    </div>
                  </div>
                  <span
                    className={`num shrink-0 text-sm ${u.kind === "Card due" ? "text-loss" : ""}`}
                  >
                    {formatInr(u.amount)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1.5 text-lg ${tone ?? ""}`}>{value}</p>
      {sub && <p className={`num text-xs ${tone ?? "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

function CreditStat({
  score,
}: {
  score: { bureau: keyof typeof CREDIT_BUREAU_LABELS; score: number } | null;
}) {
  if (!score) {
    return (
      <div>
        <p className="eyebrow">Credit score</p>
        <p className="text-muted-foreground mt-1.5 text-lg">Not set</p>
        <p className="text-muted-foreground text-xs">Add it in Settings</p>
      </div>
    );
  }
  const band = scoreBand(score.score);
  const tone =
    band === "excellent" || band === "good"
      ? "text-gain"
      : band === "poor"
        ? "text-loss"
        : "";
  return (
    <div>
      <p className="eyebrow">Credit score</p>
      <p className={`num mt-1.5 text-lg ${tone}`}>{score.score}</p>
      <p className="text-muted-foreground text-xs capitalize">
        {band} · {CREDIT_BUREAU_LABELS[score.bureau]}
      </p>
    </div>
  );
}

function OverviewEmpty({ name }: { name?: string | null }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-7 py-16 text-center">
      <div>
        <p className="eyebrow">Net worth</p>
        <p className="font-display text-muted-foreground/40 mt-2 text-[clamp(2.75rem,8vw,4.25rem)] leading-none font-semibold tracking-[-0.035em]">
          ₹0
        </p>
      </div>
      <p className="text-muted-foreground max-w-sm text-sm text-balance">
        Add what you own and the number above starts telling the truth. Holdings
        first, then bank balances.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button nativeButton={false} render={<Link href="/holdings" />}>
          Add investments
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/accounts" />}
        >
          Add accounts
        </Button>
      </div>
      {name && (
        <p className="text-muted-foreground/70 text-xs">
          Signed in as {name.split(" ")[0]}
        </p>
      )}
    </div>
  );
}
