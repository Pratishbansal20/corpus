import { cn } from "@/lib/utils";

/**
 * The mark: a ring assembled from five separate arcs, one of them brass.
 *
 * Same idea as the composition line on the Overview. Separate holdings, drawn
 * to scale, closing into a single whole. The brass arc is the one you are
 * adding, which is why the ring is complete.
 *
 * Geometry: r=8 gives a circumference of 50.27. Five arcs of 6 with 4.054 gaps
 * fill it exactly; the accent circle uses one 6-length dash and a 44.27 gap so
 * only a single arc paints. The group is rotated so the accent sits at 12
 * o'clock.
 */
export function WordmarkGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-[1.35rem]", className)}
    >
      <g transform="rotate(-90 12 12)">
        <circle
          cx="12"
          cy="12"
          r="8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="6 4.054"
          className="stroke-primary/30"
        />
        {/* The closing arc, heavier and at full strength so the eye reads one
            part completing the whole rather than a dotted circle. */}
        <circle
          cx="12"
          cy="12"
          r="8"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeDasharray="6 44.27"
          className="stroke-primary"
        />
      </g>
    </svg>
  );
}

export function Wordmark({
  className,
  showTag = false,
}: {
  className?: string;
  showTag?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <WordmarkGlyph />
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[1.0625rem] leading-none font-semibold tracking-[-0.01em]">
          Corpus
        </span>
        {showTag && (
          <span className="text-muted-foreground text-[0.6875rem] tracking-[0.12em] uppercase">
            Beta
          </span>
        )}
      </span>
    </span>
  );
}
