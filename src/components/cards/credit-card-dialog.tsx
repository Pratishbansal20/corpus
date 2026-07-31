"use client";

import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { saveCreditCard } from "@/lib/cards/actions";
import {
  CARD_NETWORK_LABELS,
  type CreditCardView,
} from "@/lib/cards/constants";

function dateInputValue(d: Date | null | undefined): string {
  if (!d) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function CreditCardDialog({
  initial,
  trigger,
  label,
}: {
  initial?: CreditCardView;
  trigger: "primary" | "icon";
  label: string;
}) {
  return (
    <FormDialog
      trigger={trigger}
      label={label}
      title={initial ? "Edit card" : "Add credit card"}
      description="Last 4 digits only. Never store the full card number or CVV."
      submitLabel={initial ? "Save changes" : "Add card"}
      action={saveCreditCard}
    >
      {(state) => (
        <>
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <Field
            label="Issuer / bank"
            htmlFor="issuer"
            error={state.fieldErrors?.issuer}
          >
            <Input
              id="issuer"
              name="issuer"
              defaultValue={initial?.issuer ?? ""}
              placeholder="HDFC Bank"
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Network" htmlFor="network">
              <select
                id="network"
                name="network"
                defaultValue={initial?.network ?? "VISA"}
                className={selectClass}
              >
                {Object.entries(CARD_NETWORK_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Last 4 digits"
              htmlFor="last4"
              error={state.fieldErrors?.last4}
            >
              <Input
                id="last4"
                name="last4"
                inputMode="numeric"
                maxLength={4}
                defaultValue={initial?.last4 ?? ""}
                placeholder="1234"
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label="Nickname (optional)" htmlFor="nickname">
            <Input
              id="nickname"
              name="nickname"
              defaultValue={initial?.nickname ?? ""}
              placeholder="Travel card"
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Credit limit (₹)"
              htmlFor="creditLimit"
              error={state.fieldErrors?.creditLimit}
            >
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="any"
                min="0"
                defaultValue={initial?.creditLimit ?? ""}
                placeholder="200000"
              />
            </Field>
            <Field
              label="Outstanding (₹)"
              htmlFor="currentOutstanding"
              error={state.fieldErrors?.currentOutstanding}
            >
              <Input
                id="currentOutstanding"
                name="currentOutstanding"
                type="number"
                step="any"
                min="0"
                defaultValue={initial?.currentOutstanding ?? ""}
                placeholder="12500"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Statement day"
              htmlFor="statementDay"
              error={state.fieldErrors?.statementDay}
            >
              <Input
                id="statementDay"
                name="statementDay"
                type="number"
                min="1"
                max="31"
                defaultValue={initial?.statementDay ?? ""}
                placeholder="1"
              />
            </Field>
            <Field
              label="Due day"
              htmlFor="dueDay"
              error={state.fieldErrors?.dueDay}
            >
              <Input
                id="dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="31"
                defaultValue={initial?.dueDay ?? ""}
                placeholder="15"
              />
            </Field>
          </div>
          <Field
            label="Next due date (optional)"
            htmlFor="currentDueDate"
            error={state.fieldErrors?.currentDueDate}
          >
            <Input
              id="currentDueDate"
              name="currentDueDate"
              type="date"
              defaultValue={dateInputValue(initial?.currentDueDate)}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
