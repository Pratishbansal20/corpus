import { SectionHeading } from "@/components/layout/section-heading";
import {
  LoadingEyebrow,
  SkeletonCard,
  SkeletonCardHeader,
  SkeletonCompositionLine,
  SkeletonDonut,
  SkeletonRow,
  SkeletonStatRail,
} from "@/components/layout/loading/skeleton-kit";

// Shown the instant a navigation to /dashboard starts, replaced by the real
// page as soon as its data resolves. Traces the real page's layout exactly
// (hero, stat rail, chart, allocation, the two list cards) so nothing shifts
// on the swap.
export default function OverviewLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <section className="flex flex-col gap-6">
        <div>
          <LoadingEyebrow label="Net worth" />
          <div className="skeleton mt-2 h-[clamp(2.75rem,8vw,4.25rem)] w-2/3 max-w-md rounded-2xl" />
        </div>
        <SkeletonCompositionLine />
      </section>

      <SkeletonStatRail />

      <section className="flex flex-col gap-4">
        <SectionHeading title="Net worth over time" />
        <SkeletonCard>
          <div className="skeleton h-40 w-full rounded-lg" />
        </SkeletonCard>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading title="Allocation" hint="Investments only" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCard>
            <SkeletonCardHeader titleWidth="w-28" descriptionWidth="w-36" />
            <SkeletonDonut />
          </SkeletonCard>
          <SkeletonCard>
            <SkeletonCardHeader titleWidth="w-24" descriptionWidth="w-32" />
            <SkeletonDonut />
          </SkeletonCard>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonCard>
          <SkeletonCardHeader titleWidth="w-28" descriptionWidth="w-32" />
          <div className="flex flex-col divide-y divide-border">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonCardHeader titleWidth="w-24" descriptionWidth="w-36" />
          <div className="flex flex-col divide-y divide-border">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </SkeletonCard>
      </div>
    </div>
  );
}
