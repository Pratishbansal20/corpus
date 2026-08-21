import { cn } from "@/lib/utils";

/**
 * The wordmark ring, turning.
 *
 * Same geometry as `WordmarkGlyph`: a pale five-arc ring with one brass arc
 * completing it. There, the brass arc sits still, closing the mark. Here it
 * sweeps around instead, because the page is not closed yet: this is the one
 * loading indicator the whole app uses, so seeing it always means the same
 * thing wherever it appears.
 */
export function LoadingMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-[1.15rem] shrink-0", className)}
    >
      <g transform="rotate(-90 12 12)">
        <circle
          cx="12"
          cy="12"
          r="8"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeDasharray="6 4.054"
          className="stroke-primary/25"
        />
      </g>
      <g className="spin-ring">
        <g transform="rotate(-90 12 12)">
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
      </g>
    </svg>
  );
}
