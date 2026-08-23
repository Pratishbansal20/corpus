import { cn } from "@/lib/utils";
import { MarkLineAndDot, MarkRing } from "@/lib/mark";

/**
 * The mark, in the app's own theme: `var(--primary)` instead of a literal
 * hex, so it tracks the brass token automatically if that ever changes.
 * Geometry itself lives in `@/lib/mark`, shared with every other surface
 * that draws this mark.
 */
export function WordmarkGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-[1.35rem]", className)}
    >
      <MarkRing color="var(--primary)" />
      <MarkLineAndDot color="var(--primary)" />
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
