import { Info } from "lucide-react";
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
import { formatInr } from "@/lib/money";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { RefreshFundsButton } from "@/components/funds/refresh-funds-button";
import { FundHoldingsList } from "@/components/funds/fund-holdings-list";

function overlapColor(pct: number): string {
  // 0–25%+ mapped to increasing primary tint.
  const a = Math.min(pct / 22, 1);
  return `color-mix(in oklch, var(--chart-1) ${Math.round(a * 100)}%, transparent)`;
}

export default async function FundsPage() {
  const user = await requireUser();
  const analysis = await getUserFundAnalysis(user.id);

  if (analysis.funds.length === 0) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mutual Funds</CardTitle>
            <CardDescription>
              Add mutual-fund holdings on the Investments page to see overlap,
              sector, and company analysis here.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const withData = analysis.funds.filter((f) => f.constituents.length > 0);
  const topCompanies = analysis.companies.slice(0, 15);
  const maxCompanyVal = topCompanies[0]?.valueInr ?? 1;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Mutual Funds</h2>
          <p className="text-muted-foreground text-sm">
            {formatInr(analysis.totalMfValueInr)} across {analysis.funds.length}{" "}
            fund{analysis.funds.length > 1 ? "s" : ""} ·{" "}
            {analysis.fundsWithData} analysed
          </p>
        </div>
        <RefreshFundsButton />
      </div>

      {/* Data disclaimer */}
      <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg border px-4 py-2.5 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Constituent data is scraped from Groww&apos;s latest disclosed
          portfolios (unofficial source). Refresh pulls current holdings; if a
          fetch fails, the previous data is kept.
        </span>
      </div>

      {/* Sector + company exposure */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sector allocation</CardTitle>
            <CardDescription>Across your mutual-fund portfolio</CardDescription>
          </CardHeader>
          <CardContent>
            {analysis.sectors.length > 0 ? (
              <AllocationDonut
                data={analysis.sectors.slice(0, 8).map((s) => ({
                  label: s.sector,
                  value: s.valueInr,
                }))}
                centerLabel="Analysed"
              />
            ) : (
              <p className="text-muted-foreground text-sm">No constituent data.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top company exposure</CardTitle>
            <CardDescription>
              Your true ₹ in each stock, across all funds
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
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
                  <span className="num">{formatInr(c.valueInr)}</span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-chart-1 h-full rounded-full"
                    style={{
                      width: `${(c.valueInr / maxCompanyVal) * 100}%`,
                      background: "var(--chart-1)",
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Overlap matrix */}
      {withData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fund overlap</CardTitle>
            <CardDescription>
              Shared holdings between funds. Higher means more duplication
            </CardDescription>
          </CardHeader>
          <CardContent>
            {withData.length > 3 && (
              <p className="text-muted-foreground mb-2 text-xs sm:hidden">
                Scroll horizontally to see all funds →
              </p>
            )}
            <div className="overflow-x-auto">
              <OverlapMatrix
                funds={withData.map((f) => ({ id: f.instrumentId, name: f.name }))}
                overlaps={analysis.overlaps}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-fund breakdown */}
      <div className="flex flex-col gap-4">
        {analysis.funds.map((f) => (
          <Card key={f.instrumentId}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{f.name}</CardTitle>
                  <CardDescription>
                    {formatInr(f.valueInr)}
                    {f.constituents.length > 0
                      ? ` · top ${f.constituents.length} = ${f.coveragePct.toFixed(0)}% of fund`
                      : " · no constituent data yet"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            {f.constituents.length > 0 && (
              <CardContent>
                <FundHoldingsList constituents={f.constituents} />
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function OverlapMatrix({
  funds,
  overlaps,
}: {
  funds: { id: string; name: string }[];
  overlaps: {
    aId: string;
    bId: string;
    overlapPct: number;
    commonStocks: number;
  }[];
}) {
  const lookup = new Map<string, number>();
  for (const o of overlaps) {
    lookup.set(`${o.aId}|${o.bId}`, o.overlapPct);
    lookup.set(`${o.bId}|${o.aId}`, o.overlapPct);
  }
  const short = (name: string) =>
    name.replace(/ (Fund|Direct|Growth|Plan|Cap).*$/i, "").slice(0, 14);

  return (
    // w-max (not w-full) so the table sizes to its content and the parent's
    // overflow-x-auto actually scrolls on narrow screens instead of squishing
    // every column to fit: illegible once there are more than ~4 funds.
    <table className="w-max border-separate border-spacing-1 text-xs">
      <thead>
        <tr>
          <th className="text-left font-normal" />
          {funds.map((f) => (
            <th
              key={f.id}
              className="text-muted-foreground min-w-14 px-1 text-center font-normal"
            >
              {short(f.name)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {funds.map((row) => (
          <tr key={row.id}>
            <td className="text-muted-foreground pr-2 whitespace-nowrap">
              {short(row.name)}
            </td>
            {funds.map((col) => {
              if (row.id === col.id) {
                return (
                  <td
                    key={col.id}
                    className="text-muted-foreground/40 min-w-14 text-center"
                  >
                    ·
                  </td>
                );
              }
              const pct = lookup.get(`${row.id}|${col.id}`) ?? 0;
              return (
                <td
                  key={col.id}
                  className="min-w-14 rounded-md text-center num"
                  style={{ background: overlapColor(pct) }}
                >
                  {pct.toFixed(0)}%
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
