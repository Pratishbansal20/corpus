import { LoadingMark } from "@/components/layout/loading/loading-mark";
import { SkeletonBar, SkeletonCard } from "@/components/layout/loading/skeleton-kit";

function LabelValueRow() {
  return (
    <div className="flex items-center justify-between gap-4">
      <SkeletonBar className="h-3.5 w-16" />
      <SkeletonBar className="h-3.5 w-32" />
    </div>
  );
}

export default function SettingsLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <SkeletonCard>
        <div className="flex items-center gap-3">
          <div className="skeleton size-10 shrink-0 rounded-xl" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <LoadingMark />
              <SkeletonBar className="h-4 w-16" />
            </div>
            <SkeletonBar className="h-3 w-40" />
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <LabelValueRow />
          <LabelValueRow />
          <LabelValueRow />
        </div>
      </SkeletonCard>

      {["w-32", "w-20", "w-24"].map((w, i) => (
        <SkeletonCard key={i}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="skeleton size-10 shrink-0 rounded-xl" />
              <div className="flex flex-col gap-2">
                <SkeletonBar className={`h-4 ${w}`} />
                <SkeletonBar className="h-3 w-44" />
              </div>
            </div>
            <div className="skeleton h-8 w-24 shrink-0 rounded-lg" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}
