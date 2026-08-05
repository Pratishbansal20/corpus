"use client";

import * as React from "react";
import { useActionState, useEffect } from "react";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
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
import {
  createHolding,
  updateHolding,
  type HoldingActionState,
} from "@/lib/holdings/actions";
import { INSTRUMENT_TYPE_LABELS } from "@/lib/holdings/schema";
import type { InstrumentHit } from "@/lib/instruments/search";
import { InstrumentSearch } from "./instrument-search";

const initialHoldingActionState: HoldingActionState = { status: "idle" };
import type { HoldingView } from "@/lib/portfolio/valuation";

const SOURCES = ["MANUAL", "GROWW", "PAYTM_MONEY", "INDMONEY"] as const;

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
        {/* Remount per open so the form/state always starts fresh. */}
        {open && (
          <HoldingFlow
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

/**
 * Adding leads with search; editing goes straight to the fields.
 *
 * Search first because the hard part of adding a holding was never the numbers,
 * it was knowing the exact ticker and, for a fund, the AMFI scheme code. Once
 * something is picked those are already filled and the only thing left to enter
 * is what was actually bought.
 */
function HoldingFlow({
  mode,
  initial,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: HoldingView;
  onDone: () => void;
}) {
  const [picked, setPicked] = React.useState<InstrumentHit | null>(null);
  const [manual, setManual] = React.useState(mode === "edit");

  if (mode === "create" && !picked && !manual) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Add holding</DialogTitle>
          <DialogDescription>
            Search by name. The ticker, and a fund&apos;s scheme code, are
            filled in for you.
          </DialogDescription>
        </DialogHeader>
        <InstrumentSearch
          autoFocus
          onPick={setPicked}
          onManual={() => setManual(true)}
        />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Add holding" : "Edit holding"}
        </DialogTitle>
        <DialogDescription>
          {picked
            ? "Enter what you bought. Everything else is already filled in."
            : "Country and currency are derived from the asset type."}
        </DialogDescription>
      </DialogHeader>

      {mode === "create" && (
        <button
          type="button"
          onClick={() => {
            setPicked(null);
            setManual(false);
          }}
          className="text-muted-foreground hover:text-foreground -mb-1 flex items-center gap-1.5 self-start text-xs"
        >
          <ArrowLeft className="size-3.5" />
          Back to search
        </button>
      )}

      <HoldingFormInner
        mode={mode}
        initial={initial}
        picked={picked}
        onDone={onDone}
      />
    </>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-destructive mt-1 text-xs">{messages[0]}</p>;
}

function HoldingFormInner({
  mode,
  initial,
  picked,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: HoldingView;
  picked: InstrumentHit | null;
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
  const type = picked?.type ?? initial?.type ?? "IN_STOCK";
  const isFund = type === "MUTUAL_FUND";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && <input type="hidden" name="id" value={initial!.id} />}

      {state.status === "error" && state.message && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
          {state.message}
        </p>
      )}

      {picked ? (
        // Resolved by search: show what was picked as a fact, not as four
        // editable fields the user would only get wrong.
        <div className="border-border bg-muted/40 flex flex-col gap-0.5 rounded-lg border px-3 py-2.5">
          <span className="truncate text-sm font-medium">{picked.name}</span>
          <span className="text-muted-foreground text-xs">
            {INSTRUMENT_TYPE_LABELS[picked.type]}
            {picked.hint && <> · {picked.hint}</>}
            {!isFund && <> · {picked.symbol}</>}
            {isFund && picked.externalId && <> · scheme {picked.externalId}</>}
          </span>
          <input type="hidden" name="type" value={picked.type} />
          <input type="hidden" name="symbol" value={picked.symbol} />
          <input type="hidden" name="name" value={picked.name} />
          <input
            type="hidden"
            name="externalId"
            value={picked.externalId ?? ""}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Asset type</Label>
            <select
              id="type"
              name="type"
              defaultValue={type}
              className={selectClass}
            >
              <option value="IN_STOCK">Indian Stock</option>
              <option value="MUTUAL_FUND">Mutual Fund</option>
              <option value="US_STOCK">US Stock</option>
            </select>
          </div>

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
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quantity">{isFund ? "Units" : "Quantity"}</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            step="any"
            min="0"
            placeholder={isFund ? "203.141" : "10"}
            defaultValue={initial?.quantity ?? ""}
          />
          <FieldError messages={errors?.quantity} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avgBuyPrice">
            {isFund ? "Avg buy NAV" : "Avg buy price"}
          </Label>
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
