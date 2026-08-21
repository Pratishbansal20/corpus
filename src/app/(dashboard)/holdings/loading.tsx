import { LoadingMark } from "@/components/layout/loading/loading-mark";
import { SkeletonBar, SkeletonRow } from "@/components/layout/loading/skeleton-kit";

// Investments is the heaviest page in the app to assemble (holdings, prices,
// live FX, SIPs and bank links all resolve before it can render), so it's
// the one this was written against. Traces the header, the app-consolidation
// row and the holdings table exactly so the swap to real data doesn't shift
// anything under the cursor.
export default function HoldingsLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LoadingMark />
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
              Investments
            </h2>
          </div>
          <SkeletonBar className="mt-2 h-3.5 w-48" />
        </div>
        <div className="skeleton h-8 w-32 rounded-lg" />
      </div>

      {/* App-wise consolidation */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3 ring-1 ring-border"
          >
            <SkeletonBar className="h-3 w-16" />
            <SkeletonBar className="h-4 w-20" />
          </div>
        ))}
      </div>

      {/* Holdings table */}
      <div className="border-border overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/40 flex items-center gap-6 border-b px-4 py-2.5">
          {["Instrument", "Source", "Qty", "Avg buy", "Value", "P/L"].map((label) => (
            <SkeletonBar key={label} className="h-2.5 w-14 first:flex-1" />
          ))}
        </div>
        <div className="divide-border flex flex-col divide-y px-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonRow key={i} withBadge />
          ))}
        </div>
      </div>
    </div>
  );
}
