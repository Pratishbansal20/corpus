import { Wallet } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/require-user";
import { getUserPortfolio } from "@/lib/holdings/queries";
import { getSipPlans, getSipBankOptions } from "@/lib/sips/queries";
import { consolidateBySource } from "@/lib/holdings/consolidation";
import { formatInr, formatPct } from "@/lib/money";
import { HoldingFormDialog } from "@/components/holdings/holding-form-dialog";
import { HoldingsTable } from "@/components/holdings/holdings-table";
import { SipSection } from "@/components/sips/sip-section";

function pnlClass(value: number): string {
  if (value > 0) return "text-gain";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

export default async function HoldingsPage() {
  const user = await requireUser();
  const [{ holdings, summary }, sips, banks] = await Promise.all([
    getUserPortfolio(user.id),
    getSipPlans(user.id),
    getSipBankOptions(user.id),
  ]);

  const hasUsHolding = holdings.some((h) => h.country === "US");
  const consolidation = consolidateBySource(holdings);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">Investments</h2>
          <p className="text-muted-foreground text-sm">
            {summary.holdingsCount > 0
              ? `${summary.holdingsCount} position${summary.holdingsCount > 1 ? "s" : ""} · ${formatInr(summary.totalValueInr)}`
              : "Every position across Indian stocks, mutual funds & US stocks."}
          </p>
        </div>
        <HoldingFormDialog mode="create" trigger="primary" label="Add holding" />
      </div>

      {holdings.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* App-wise consolidation */}
          {consolidation.groups.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By app</CardTitle>
                <CardDescription>Where your investments live</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {consolidation.groups.map((g) => (
                  <div
                    key={g.source}
                    className="border-border rounded-lg border p-3"
                  >
                    <div className="text-muted-foreground text-xs">
                      {g.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold num">
                      {formatInr(g.valueInr)}
                    </div>
                    <div className={`text-xs num ${pnlClass(g.pnlInr)}`}>
                      {formatPct(g.pnlPct)} · {g.weightPct.toFixed(0)}%
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <HoldingsTable holdings={holdings} />
          {hasUsHolding && !summary.fxIsLive && (
            <p className="text-muted-foreground text-xs">
              US holdings use a fallback USD/INR rate until FX is refreshed.
              Tap Refresh in the top bar after adding holdings.
            </p>
          )}
          {!summary.hasLivePrices && holdings.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Values reflect cost basis until live prices are fetched. Tap
              Refresh in the top bar.
            </p>
          )}
        </>
      )}

      <SipSection sips={sips} banks={banks} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
        <Wallet className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium">No holdings yet</p>
        <p className="text-muted-foreground max-w-xs text-sm text-balance">
          Add your first position to see your portfolio come together. CSV
          import arrives later.
        </p>
      </div>
      <HoldingFormDialog
        mode="create"
        trigger="primary"
        label="Add your first holding"
      />
    </div>
  );
}
