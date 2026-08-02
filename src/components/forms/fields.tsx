import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

// Shared styling for native <select> elements (matches the Input look).
//
// The colours are stated outright rather than left transparent: a bare <select>
// inherits the platform's own control colours, which on a dark app meant dark
// text on a dark panel. The option popup itself is drawn by the browser and is
// handled by `color-scheme: dark` in globals.css, not from here.
export const selectClass =
  "border-input bg-input/30 text-foreground h-9 w-full cursor-pointer rounded-lg border px-3 text-sm outline-none transition-colors hover:bg-input/45 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-destructive mt-1 text-xs">{messages[0]}</p>;
}

// Label + control + error + optional hint, vertically stacked.
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string[];
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      <FieldError messages={error} />
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
