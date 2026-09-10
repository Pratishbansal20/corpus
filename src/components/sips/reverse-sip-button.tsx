"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reverseSip } from "@/lib/sips/actions";

/**
 * Undoes the most recent debit on a plan — a bounced mandate, or one applied
 * by mistake. Only ever offered for the plan's latest, not-yet-reversed
 * execution (SipSection only renders this when that's what's on screen);
 * lib/sips/reverse.ts re-checks the same thing server-side regardless.
 */
export function ReverseSipButton({
  sipPlanId,
  fundName,
}: {
  sipPlanId: string;
  fundName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    startTransition(async () => {
      const result = await reverseSip(sipPlanId);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.reason);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-loss bg-loss/10 hover:bg-loss/20 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors"
      >
        <Undo2 className="size-3" />
        Reverse
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse this debit?</DialogTitle>
          <DialogDescription>
            Undoes the units and the bank debit for {fundName}&apos;s most
            recent applied SIP, as if it never happened. The plan itself
            keeps running; only this one debit is undone.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Reversing…" : "Reverse debit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
