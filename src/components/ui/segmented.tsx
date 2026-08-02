"use client";

import { cn } from "@/lib/utils";

/**
 * A small segmented control: a row of mutually exclusive options that sits in
 * the top-right of a section header.
 *
 * Shared so the net-worth range picker and the fund-overlap scope picker are
 * the same object in two places rather than two lookalikes that drift apart.
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  items: readonly { key: T; label: string; title?: string }[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "bg-muted/60 flex w-fit shrink-0 gap-0.5 rounded-lg p-1",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.key}
          role="tab"
          type="button"
          title={item.title}
          aria-selected={value === item.key}
          onClick={() => onChange(item.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === item.key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
