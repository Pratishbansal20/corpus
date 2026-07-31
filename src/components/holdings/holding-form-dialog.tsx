"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createHolding,
  updateHolding,
  type HoldingActionState,
} from "@/lib/holdings/actions";

const initialHoldingActionState: HoldingActionState = { status: "idle" };
import type { HoldingView } from "@/lib/portfolio/valuation";

const SOURCES = ["MANUAL", "GROWW", "PAYTM_MONEY", "INDMONEY"] as const;

const selectClass =
  "border-input bg-transparent dark:bg-input/30 h-9 w-full rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Props = {
  mode: "create" | "edit";
  initial?: HoldingView;
  // The trigger is built inside this client component (rather than passed in as
  // JSX) so no React elements cross the server→client boundary.
  trigger: "primary" | "icon";
  label: string;
  className?: string;
};

export function HoldingFormDialog({
  mode,
  initial,
  trigger,
  label,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      {trigger === "primary" ? (
        <Button className={className ?? "gap-2"} onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {label}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add holding" : "Edit holding"}
          </DialogTitle>
          <DialogDescription>
            Country and currency are derived from the asset type.
          </DialogDescription>
        </DialogHeader>
        {/* Remount per open so the form/state always starts fresh. */}
        {open && (
          <HoldingFormInner
            key={initial?.id ?? "new"}
            mode={mode}
            initial={initial}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-destructive mt-1 text-xs">{messages[0]}</p>;
}

function HoldingFormInner({
  mode,
  initial,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: HoldingView;
  onDone: () => void;
}) {
  const action = mode === "create" ? createHolding : updateHolding;
  const [state, formAction, pending] = useActionState(
    action,
    initialHoldingActionState,
  );

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  const errors = state.fieldErrors;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}

      {state.status === "error" && state.message && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="type">Asset type</Label>
        <select
          id="type"
          name="type"
          defaultValue={initial?.type ?? "IN_STOCK"}
          className={selectClass}
        >
          <option value="IN_STOCK">Indian Stock</option>
          <option value="MUTUAL_FUND">Mutual Fund</option>
          <option value="US_STOCK">US Stock</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="symbol">Symbol</Label>
          <Input
            id="symbol"
            name="symbol"
            placeholder="INFY · AAPL"
            defaultValue={initial?.symbol ?? ""}
            autoComplete="off"
          />
          <FieldError messages={errors?.symbol} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">Source</Label>
          <select
            id="source"
            name="source"
            defaultValue={initial?.source ?? "MANUAL"}
            className={selectClass}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Infosys Ltd · Parag Parikh Flexi Cap"
          defaultValue={initial?.name ?? ""}
          autoComplete="off"
        />
        <FieldError messages={errors?.name} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="externalId">AMFI scheme code (optional)</Label>
        <Input
          id="externalId"
          name="externalId"
          inputMode="numeric"
          placeholder="120503 (for mutual fund NAV lookup)"
          autoComplete="off"
        />
        <FieldError messages={errors?.externalId} />
        <p className="text-muted-foreground text-xs">
          Mutual funds only. Improves live NAV matching on Refresh.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantity">Quantity / units</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step="any"
            min="0"
            placeholder="10"
            defaultValue={initial?.quantity ?? ""}
          />
          <FieldError messages={errors?.quantity} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avgBuyPrice">Avg buy price</Label>
          <Input
            id="avgBuyPrice"
            name="avgBuyPrice"
            type="number"
            step="any"
            min="0"
            placeholder="1500"
            defaultValue={initial?.avgBuyPrice ?? ""}
          />
          <FieldError messages={errors?.avgBuyPrice} />
          <p className="text-muted-foreground text-xs">
            Per unit, in the asset&apos;s own currency.
          </p>
        </div>
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Add holding"
              : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}
