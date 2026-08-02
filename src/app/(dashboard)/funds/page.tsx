import { Info, CalendarClock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/require-user";
import { getUserFundAnalysis } from "@/lib/funds/queries";
import { getSipPlans, monthlySipTotal } from "@/lib/sips/queries";
import { formatInr, formatPct, formatSignedInr } from "@/lib/money";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { RefreshFundsButton } from "@/components/funds/refresh-funds-button";
import { FundHoldingsList } from "@/components/funds/fund-holdings-list";
import { OverlapMatrix } from "@/components/funds/overlap-matrix";
import { SipAppliedNote } from "@/components/sips/sip-applied-note";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function pnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

export default async function FundsPage() {
  const user = await requireUser();
  const [analysis, sips] = await Promise.all([
    getUserFundAnalysis(user.id),
    getSipPlans(user.id),
  ]);

  if (analysis.funds.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Mutual funds</CardTitle>
            <CardDescription>
              Add mutual-fund holdings on the Investments page to see overlap,
              sector, and company analysis here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // A fund counts as an active SIP if a live plan points at its instrument.
  const activeSips = sips.filter((s) => s.active);
  const sipByInstrument = new Map(activeSips.map((s) => [s.instrumentId, s]));
  const monthlyCommitment = monthlySipTotal(sips);

  const withData = analysis.funds.filter((f) => f.constituents.length > 0);
  const topCompanies = analysis.companies.slice(0, 20);
  const maxCompanyVal = topCompanies[0]?.valueInr ?? 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
            Mutual funds
          </h2>
          <p className="text-muted-foreground text-sm">
            {analysis.funds.length} fund{analysis.funds.length > 1 ? "s" : ""} ·{" "}
            {analysis.fundsWithData} analysed for overlap
          </p>
        </div>
        <RefreshFundsButton />
      </div>

      {/* Where you stand, before any analysis. */}
      <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 sm:grid-cols-4">
        <div>
          <p className="eyebrow">Invested</p>
          <p className="num mt-1.5 text-lg">
            {formatInr(analysis.totalMfInvestedInr)}
          </p>
        </div>
        <div>
          <p className="eyebrow">Current value</p>
          <p className="num mt-1.5 text-lg">
            {formatInr(analysis.totalMfValueInr)}
          </p>
        </div>
        <div>
          <p className="eyebrow">Returns</p>
          <p className={`num mt-1.5 text-lg ${pnlClass(analysis.totalReturnsInr)}`}>
            {formatPct(analysis.totalReturnsPct)}
          </p>
          <p className={`num text-xs ${pnlClass(analysis.totalReturnsInr)}`}>
            {formatSignedInr(analysis.totalReturnsInr)}
          </p>
        </div>
        <div>
          <p className="eyebrow">Active SIPs</p>
          <p className="num mt-1.5 text-lg">{activeSips.length}</p>
          {monthlyCommitment > 0 && (
            <p className="text-muted-foreground num text-xs">
              {formatInr(monthlyCommitment)} / month
            </p>
          )}
        </div>
      </section>

      {/* Upcoming SIP dates, so the schedule lives beside the funds it feeds. */}
      {activeSips.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>SIP schedule</CardTitle>
                <CardDescription>
                  Next debit for each active plan
                </CardDescription>
              </div>
              <CalendarClock className="text-muted-foreground size-5 shrink-0" />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {activeSips.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate">{s.fundName}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {dateFmt.format(s.nextDate)}
                  </span>
                  <span className="num shrink-0 text-sm">
                    {formatInr(s.amountInr)}
                  </span>
                </div>
                {s.bankLabel && (
                  <p className="text-muted-foreground text-xs">
                    from {s.bankLabel}
                  </p>
                )}
                {s.lastApplied && <SipAppliedNote applied={s.lastApplied} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Constituent data is scraped from Groww&apos;s latest disclosed
          portfolios (unofficial source). Refresh pulls current holdings; if a
          fetch fails, the previous data is kept.
        </span>
      </div>

      {/* Sector and company exposure sit side by side, so both cards stretch to
          the taller one and the company list scrolls inside its own space. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>Sector allocation</CardTitle>
            <CardDescription>Across your mutual-fund portfolio</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 items-center">
            {analysis.sectors.length > 0 ? (
              <AllocationDonut
                data={analysis.sectors.slice(0, 8).map((s) => ({
                  label: s.sector,
                  value: s.valueInr,
                }))}
                centerLabel="Analysed"
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                No constituent data.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col">
          <CardHeader>
            <CardTitle>Top company exposure</CardTitle>
            <CardDescription>
              Your true ₹ in each stock, across all funds
            </CardDescription>
          </CardHeader>
          <CardContent className="min-h-56 flex-1 basis-0 overflow-y-auto">
            <div className="flex flex-col gap-2">
              {topCompanies.map((c) => (
                <div key={c.stock} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{c.stock}</span>
                      {c.fundCount > 1 && (
                        <Badge variant="secondary" className="text-[10px]">
                          {c.fundCount} funds
                        </Badge>
                      )}
                    </span>
                    <span className="num shrink-0">
                      {formatInr(c.valueInr)}
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(c.valueInr / maxCompanyVal) * 100}%`,
                        background: "var(--chart-1)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {withData.length > 1 && (
        <Card>
            <OverlapMatrix
              funds={withData.map((f) => ({
                id: f.instrumentId,
                name: f.name,
                hasSip: sipByInstrument.has(f.instrumentId),
              }))}
              overlaps={analysis.overlaps}
            />
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {analysis.funds.map((f) => {
          const sip = sipByInstrument.get(f.instrumentId);
          return (
            <Card key={f.instrumentId}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="truncate">{f.name}</CardTitle>
                      {sip && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 text-primary gap-1 text-[10px]"
                        >
                          SIP {formatInr(sip.amountInr)} ·{" "}
                          {dateFmt.format(sip.nextDate)}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {f.constituents.length > 0
                        ? `Top ${f.constituents.length} holdings = ${f.coveragePct.toFixed(0)}% of the fund`
                        : "No constituent data yet"}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm">{formatInr(f.valueInr)}</p>
                    <p className={`num text-xs ${pnlClass(f.returnsInr)}`}>
                      {formatPct(f.returnsPct)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              {f.constituents.length > 0 && (
                <CardContent>
                  <FundHoldingsList constituents={f.constituents} />
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
