import { cn } from "@/lib/utils";
import { LoadingMark } from "./loading-mark";

/**
 * Building blocks for route `loading.tsx` files.
 *
 * The rule that keeps these from feeling like a generic spinner-in-a-void:
 * every block sits exactly where the real element it stands in for will
 * render (a card is `SkeletonCard`-shaped before it's `Card`-shaped, a list
 * row is the same height loading as loaded), so the swap to real content
 * never shifts the page, and the loading state reads as "this page,
 * arriving" rather than "a different, blanker page."
 */

/** A shimmering bar: the stand-in for a line of text or a figure. */
export function SkeletonBar({ className }: { className?: string }) {
  return <div className={cn("skeleton h-3.5 rounded-md", className)} />;
}

/** The small brass ring plus a real (not skeleton) eyebrow label: the one
 *  loading signature repeated at the top of every page, always paired with
 *  the actual section name so the page identifies itself before anything
 *  else has loaded. */
export function LoadingEyebrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <LoadingMark />
      <p className="eyebrow">{label}</p>
    </div>
  );
}

/** The `Card` shell, empty, so cards don't visibly change shape when their
 *  real content lands. */
export function SkeletonCard({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 overflow-hidden rounded-xl bg-card px-5 py-5 ring-1 ring-border shadow-[inset_0_1px_0_0_oklch(1_0_0/6%),0_1px_2px_0_oklch(0_0_0/25%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A card header: title-width bar, description-width bar beneath it. */
export function SkeletonCardHeader({
  titleWidth = "w-32",
  descriptionWidth = "w-48",
}: {
  titleWidth?: string;
  descriptionWidth?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBar className={cn("h-4", titleWidth)} />
      <SkeletonBar className={cn("h-3", descriptionWidth)} />
    </div>
  );
}

/** One row of a list: name + subtext on the left, a figure on the right.
 *  Matches the `flex items-center justify-between gap-4 py-3` row shape used
 *  for holdings, bank accounts, cards and funds everywhere in the app. */
export function SkeletonRow({ withBadge = false }: { withBadge?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-3.5 w-28" />
          {withBadge && <SkeletonBar className="h-3.5 w-10 rounded-full" />}
        </div>
        <SkeletonBar className="h-3 w-20" />
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <SkeletonBar className="h-3.5 w-16" />
        <SkeletonBar className="h-3 w-10" />
      </div>
    </div>
  );
}

/** The four-stat rail (`grid-cols-2 ... sm:grid-cols-4`) that opens Overview
 *  and Funds: an eyebrow-height bar over a value-height bar, repeated. */
export function SkeletonStatRail({ count = 4 }: { count?: number }) {
  return (
    <section className="border-border grid grid-cols-2 gap-x-6 gap-y-6 border-y py-6 sm:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <SkeletonBar className="h-2.5 w-14" />
          <SkeletonBar className="h-5 w-20" />
        </div>
      ))}
    </section>
  );
}

/** The composition line, before its segments are known: the rule itself,
 *  plus a short legend row, in the same two-part shape as the real one. */
export function SkeletonCompositionLine() {
  return (
    <div className="flex flex-col gap-3">
      <div className="skeleton h-2.5 w-full rounded-full" />
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <SkeletonBar className="h-3.5 w-24" />
        <SkeletonBar className="h-3.5 w-20" />
        <SkeletonBar className="h-3.5 w-28" />
      </div>
    </div>
  );
}

/** A donut placeholder: a ring, not a filled disc, so it reads as "chart
 *  coming" rather than an unrelated loading spinner. */
export function SkeletonDonut() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="skeleton size-36 rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-14px),#000_calc(100%-14px))]" />
    </div>
  );
}
