"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";

export type Reminder = { id: string; message: string; href: string };

/**
 * Dismissal is session-only, on purpose: it clears the banner for the rest
 * of this visit, not forever. These nudges exist to surface real, unresolved
 * problems (a dead price feed, a balance nobody's touched in weeks) — a
 * dismiss that survives a reload would let a genuine one go quiet
 * permanently, which defeats the point. Reload, or come back tomorrow, and
 * anything still actually true still shows up.
 */
export function RemindersList({ reminders }: { reminders: Reminder[] }) {
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const visible = reminders.filter((r) => !dismissedIds.has(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((r) => (
        <div
          key={r.id}
          className="border-primary/25 bg-primary/[0.06] hover:bg-primary/[0.1] flex items-center gap-2 rounded-lg border pl-4 pr-2 py-2.5 text-xs transition-colors"
        >
          <Link
            href={r.href}
            className="text-primary/90 flex min-w-0 flex-1 items-center justify-between gap-4"
          >
            <span className="min-w-0">{r.message}</span>
            <span className="flex shrink-0 items-center gap-1 font-medium">
              Update <ArrowUpRight className="size-3.5" />
            </span>
          </Link>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() =>
              setDismissedIds((prev) => {
                const next = new Set(prev);
                next.add(r.id);
                return next;
              })
            }
            className="text-primary/50 hover:text-primary shrink-0 rounded-md p-1 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
