/**
 * Section label with a rule that runs out to the container edge. The rule is
 * doing work: it shows how wide the section's content is about to be.
 */
export function SectionHeading({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <h2 className="font-display shrink-0 text-[0.9375rem] font-semibold tracking-[-0.005em]">
        {title}
      </h2>
      <span aria-hidden className="bg-border h-px flex-1" />
      {hint && (
        <span className="text-muted-foreground shrink-0 text-xs">{hint}</span>
      )}
    </div>
  );
}
