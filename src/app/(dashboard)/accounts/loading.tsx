import { LoadingMark } from "@/components/layout/loading/loading-mark";
import { SkeletonBar, SkeletonCard, SkeletonRow } from "@/components/layout/loading/skeleton-kit";

export default function AccountsLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      {[
        { title: "w-32", desc: "w-48", rows: 2 },
        { title: "w-28", desc: "w-56", rows: 2 },
      ].map((section, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              {i === 0 ? (
                <div className="flex items-center gap-2">
                  <LoadingMark />
                  <SkeletonBar className={`h-4 ${section.title}`} />
                </div>
              ) : (
                <SkeletonBar className={`h-4 ${section.title}`} />
              )}
              <SkeletonBar className={`h-3 ${section.desc}`} />
            </div>
            <div className="skeleton h-8 w-28 rounded-lg" />
          </div>
          <div className="flex flex-col divide-y divide-border">
            {Array.from({ length: section.rows }).map((_, r) => (
              <SkeletonRow key={r} withBadge />
            ))}
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
