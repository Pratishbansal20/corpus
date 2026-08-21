import { LoadingMark } from "@/components/layout/loading/loading-mark";
import { SkeletonBar, SkeletonCard, SkeletonRow } from "@/components/layout/loading/skeleton-kit";

export default function CardsLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <SkeletonCard>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <LoadingMark />
              <SkeletonBar className="h-4 w-28" />
            </div>
            <SkeletonBar className="h-3 w-52" />
          </div>
          <div className="skeleton h-8 w-24 rounded-lg" />
        </div>
        <div className="flex flex-col divide-y divide-border">
          <SkeletonRow withBadge />
          <SkeletonRow withBadge />
          <SkeletonRow withBadge />
        </div>
      </SkeletonCard>
    </div>
  );
}
