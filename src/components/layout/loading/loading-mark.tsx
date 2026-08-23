import { cn } from "@/lib/utils";
import { MarkLineAndDot, MarkRing } from "@/lib/mark";

/**
 * The wordmark ring, turning. Same geometry as `WordmarkGlyph` (both read
 * `@/lib/mark`), split into its two halves: the line and its dot — the
 * resolved number — sit still and faint, because there's nothing to show
 * yet. The C ring spins around them instead, because the page is not closed
 * out yet: this is the one loading indicator the whole app uses, so seeing
 * it always means the same thing wherever it appears.
 */
export function LoadingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-[1.15rem] shrink-0", className)}
    >
      <MarkLineAndDot color="var(--primary)" opacity={0.25} />
      <g className="spin-ring">
        <MarkRing color="var(--primary)" />
      </g>
    </svg>
  );
}
