"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { PlusCircle } from "lucide-react";
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
import { selectClass } from "@/components/forms/fields";
import { Segmented } from "@/components/ui/segmented";
import { topUpHolding, type HoldingActionState } from "@/lib/holdings/actions";
import type { SipBankView } from "@/lib/sips/constants";
import { formatQuantity } from "@/lib/money";

const initialState: HoldingActionState = { status: "idle" };

export type TopUpTarget = {
  id: string;
  name: string;
  symbol: string;
  isFund: boolean;
  currency: string;
  quantity: number;
  avgBuyPrice: number;
};

/** Today as YYYY-MM-DD in UTC, matching how dates are stored and rendered. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Add a purchase to a position already held.
 *
 * Deliberately separate from Edit. Edit *sets* the quantity and average, which
 * is what you want to correct a mistake. Topping up *adds*, which is what you
 * want after actually buying more, and it does the weighted-average blend that
 * previously had to be worked out by hand.
 */
export function TopUpDialog({
  target,
  banks,
}: {
  target: TopUpTarget;
  banks: SipBankView[];
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Top up ${target.name}`}
        title="Top up"
        onClick={() => setOpen(true)}
      >
        <PlusCircle className="size-4" />
      </Button>

      <DialogContent>
        {open && (
          <TopUpForm
            target={target}
            banks={banks}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TopUpForm({
  target,
  banks,
  onDone,
}: {
  target: TopUpTarget;
  banks: SipBankView[];
  onDone: () => void;
}) {
  // Funds are bought with a rupee amount; shares are bought as a count at a
  // price. Default each to the way that kind of asset is actually purchased.
  const [mode, setMode] = React.useState<"AMOUNT" | "QUANTITY">(
    target.isFund ? "AMOUNT" : "QUANTITY",
  );
  const [state, formAction, pending] = useActionState(
    topUpHolding,
    initialState,
  );

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  const errors = state.fieldErrors;
  const inr = target.currency === "INR";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Top up</DialogTitle>
        <DialogDescription>
          Adds to what you already hold and blends the average for you.
        </DialogDescription>
      </DialogHeader>

      <input type="hidden" name="holdingId" value={target.id} />
      <input type="hidden" name="mode" value={mode} />

      <div className="border-border bg-muted/40 flex flex-col gap-0.5 rounded-lg border px-3 py-2.5">
        <span className="truncate text-sm font-medium">{target.name}</span>
        <span className="text-muted-foreground text-xs">
          Holding <span className="num">{formatQuantity(target.quantity)}</span>{" "}
          {target.isFund ? "units" : "shares"} at{" "}
          <span className="num">{target.avgBuyPrice.toFixed(2)}</span> avg
        </span>
      </div>

      {state.status === "error" && state.message && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
          {state.message}
        </p>
      )}

      {target.isFund && (
        <Segmented
          items={[
            { key: "AMOUNT", label: "By amount" },
            { key: "QUANTITY", label: "By units" },
          ]}
          value={mode}
          onChange={setMode}
          ariaLabel="How to enter the purchase"
          className="w-full"
        />
      )}

      {mode === "AMOUNT" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amountInr">Amount invested (₹)</Label>
            <Input
              id="amountInr"
              name="amountInr"
              type="number"
              step="any"
              min="0"
              placeholder="25000"
              autoFocus
            />
            {errors?.amountInr && (
              <p className="text-destructive text-xs">{errors.amountInr[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Purchase date</Label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={todayUtc()}
              max={todayUtc()}
            />
            <p className="text-muted-foreground text-xs">
              Priced at that day&apos;s NAV.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quantity">
              {target.isFund ? "Units bought" : "Shares bought"}
            </Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              step="any"
              min="0"
              placeholder={target.isFund ? "203.141" : "10"}
              autoFocus
            />
            {errors?.quantity && (
              <p className="text-destructive text-xs">{errors.quantity[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pricePerUnit">Price paid per unit</Label>
            <Input
              id="pricePerUnit"
              name="pricePerUnit"
              type="number"
              step="any"
              min="0"
              placeholder="1500"
            />
            {errors?.pricePerUnit && (
              <p className="text-destructive text-xs">
                {errors.pricePerUnit[0]}
              </p>
            )}
            <p className="text-muted-foreground text-xs">
              In {target.currency}.
            </p>
          </div>
        </div>
      )}

      {inr && banks.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bankAccountId">Paid from (optional)</Label>
          <select
            id="bankAccountId"
            name="bankAccountId"
            defaultValue=""
            className={selectClass}
          >
            <option value="">Do not adjust any balance</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            Deducts the amount from that account, so cash and units stay in step.
          </p>
        </div>
      )}

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to holding"}
        </Button>
      </DialogFooter>
    </form>
  );
}
