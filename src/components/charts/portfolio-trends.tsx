"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeading } from "@/components/layout/section-heading";
import { Segmented } from "@/components/ui/segmented";
import {
  TREND_RANGES,
  niceDomain,
  rangeDays,
  sliceToRange,
  type TrendRangeKey,
} from "@/lib/networth/trend-range";
import type { NetWorthPoint, ReturnsPoint } from "@/lib/networth/snapshot";
import { NetWorthTrendChart } from "./net-worth-trend";
import { ReturnsTrendChart } from "./returns-trend";

const SYNC_ID = "portfolio-trends";

const labelFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const monthFmt = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/**
 * Net worth and investment returns, one range control between them.
 *
 * They used to be two independent charts, each with its own range picker,
 * which meant hovering one couldn't sensibly highlight the same date on the
 * other: nothing guaranteed they were even showing the same window. Sharing
 * one `range` here removes that possibility rather than working around it,
 * and recharts' own `syncId` (both charts below pass the same one) then
 * syncs the hover/tooltip between them for free, since a shared range means
 * both slices always have the same dates at the same array index.
 */
export function PortfolioTrends({
  netWorthData,
  returnsData,
  hasInvestments,
}: {
  netWorthData: NetWorthPoint[];
  returnsData: ReturnsPoint[];
  /** Hides the returns card: it has nothing to say with no holdings. */
  hasInvestments: boolean;
}) {
  const [range, setRange] = useState<TrendRangeKey>("1M");

  const { netWorthPoints, netWorthDomain, returnsPoints, returnsDomain, recordedDays, shortOnHistory } =
    useMemo(() => {
      const days = rangeDays(range);
      // Past about six months a day-and-month tick is noise, so widen the label.
      const fmt = days > 182 ? monthFmt : labelFmt;

      const nw = sliceToRange(netWorthData, days);
      const rt = sliceToRange(returnsData, days);

      return {
        // Both slices come from the same PortfolioSnapshot rows over the
        // same window, so they always agree on this; either would do.
        recordedDays: nw.recordedDays,
        shortOnHistory: nw.shortOnHistory,
        netWorthPoints: nw.points.map((d) => ({
          ...d,
          label: fmt.format(new Date(d.date)),
        })),
        netWorthDomain: niceDomain(nw.points.map((d) => d.netWorthInr)),
        returnsPoints: rt.points.map((d) => ({
          ...d,
          label: fmt.format(new Date(d.date)),
        })),
        returnsDomain: niceDomain(rt.points.map((d) => d.pnlInr)),
      };
    }, [netWorthData, returnsData, range]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading title="Trends" />

      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground min-w-0 truncate text-xs">
          {shortOnHistory
            ? `${recordedDays} day${recordedDays === 1 ? "" : "s"} recorded so far`
            : `${netWorthPoints.length} day${netWorthPoints.length === 1 ? "" : "s"} shown`}
        </p>
        <Segmented
          items={TREND_RANGES}
          value={range}
          onChange={setRange}
          ariaLabel="Trends time range"
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Net worth</CardTitle>
          </CardHeader>
          <CardContent>
            {netWorthPoints.length >= 2 ? (
              <NetWorthTrendChart
                points={netWorthPoints}
                domain={netWorthDomain}
                syncId={SYNC_ID}
              />
            ) : (
              <EmptyState text="No net worth recorded in this window yet." />
            )}
          </CardContent>
        </Card>

        {hasInvestments && (
          <Card>
            <CardHeader>
              <CardTitle>Investment returns</CardTitle>
              <CardDescription>Value minus what you&apos;ve put in</CardDescription>
            </CardHeader>
            <CardContent>
              {returnsPoints.length >= 2 ? (
                <ReturnsTrendChart
                  points={returnsPoints}
                  domain={returnsDomain}
                  syncId={SYNC_ID}
                />
              ) : (
                <EmptyState text="No returns recorded in this window yet." />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border-border text-muted-foreground flex h-56 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-balance">
      {text}
    </div>
  );
}
