import { LoadingMark } from "@/components/layout/loading/loading-mark";
import {
  SkeletonBar,
  SkeletonCard,
  SkeletonCardHeader,
  SkeletonDonut,
  SkeletonRow,
  SkeletonStatRail,
} from "@/components/layout/loading/skeleton-kit";

export default function FundsLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <LoadingMark />
            <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
              Mutual funds
            </h2>
          </div>
          <SkeletonBar className="mt-2 h-3.5 w-40" />
        </div>
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>

      <SkeletonStatRail />

      <SkeletonCard>
        <SkeletonCardHeader titleWidth="w-32" descriptionWidth="w-44" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBar key={i} className="h-4 w-full" />
          ))}
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <SkeletonCardHeader titleWidth="w-32" descriptionWidth="w-40" />
          <SkeletonDonut />
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonCardHeader titleWidth="w-36" descriptionWidth="w-44" />
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar key={i} className="h-3.5 w-full" />
            ))}
          </div>
        </SkeletonCard>
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i}>
            <SkeletonCardHeader titleWidth="w-56" descriptionWidth="w-40" />
            <div className="flex flex-col divide-y divide-border">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}
