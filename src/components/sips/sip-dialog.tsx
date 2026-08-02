"use client";

import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { saveSip } from "@/lib/sips/actions";
import {
  SIP_FREQUENCY_LABELS,
  type SipBankView,
  type SipView,
} from "@/lib/sips/constants";

const SOURCES = ["MANUAL", "GROWW", "PAYTM_MONEY", "INDMONEY"] as const;

export function SipDialog({
  initial,
  trigger,
  label,
  banks = [],
}: {
  initial?: SipView;
  trigger: "primary" | "icon";
  label: string;
  banks?: SipBankView[];
}) {
  return (
    <FormDialog
      trigger={trigger}
      label={label}
      title={initial ? "Edit SIP" : "Add SIP"}
      description="A recurring investment into a mutual fund."
      submitLabel={initial ? "Save changes" : "Add SIP"}
      action={saveSip}
    >
      {(state) => (
        <>
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Fund symbol"
              htmlFor="symbol"
              error={state.fieldErrors?.symbol}
            >
              <Input
                id="symbol"
                name="symbol"
                defaultValue={initial?.fundSymbol ?? ""}
                placeholder="PPFAS_FLEXI"
                autoComplete="off"
              />
            </Field>
            <Field label="Source" htmlFor="source">
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
            </Field>
          </div>
          <Field
            label="Fund name"
            htmlFor="name"
            error={state.fieldErrors?.name}
          >
            <Input
              id="name"
              name="name"
              defaultValue={initial?.fundName ?? ""}
              placeholder="Parag Parikh Flexi Cap"
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Amount (₹)"
              htmlFor="amountInr"
              error={state.fieldErrors?.amountInr}
            >
              <Input
                id="amountInr"
                name="amountInr"
                type="number"
                step="any"
                min="0"
                defaultValue={initial?.amountInr ?? ""}
                placeholder="5000"
              />
            </Field>
            <Field label="Frequency" htmlFor="frequency">
              <select
                id="frequency"
                name="frequency"
                defaultValue={initial?.frequency ?? "MONTHLY"}
                className={selectClass}
              >
                {Object.entries(SIP_FREQUENCY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Day"
              htmlFor="dayOfMonth"
              error={state.fieldErrors?.dayOfMonth}
            >
              <Input
                id="dayOfMonth"
                name="dayOfMonth"
                type="number"
                min="1"
                max="31"
                defaultValue={initial?.dayOfMonth ?? ""}
                placeholder="5"
              />
            </Field>
          </div>
          <Field
            label="Debit from"
            htmlFor="bankAccountId"
            error={state.fieldErrors?.bankAccountId}
            hint={
              banks.length > 0
                ? "The amount is deducted from this account when the units are allotted."
                : "Add a bank account to track the cash leaving."
            }
          >
            <select
              id="bankAccountId"
              name="bankAccountId"
              defaultValue={initial?.bankAccountId ?? ""}
              className={selectClass}
              disabled={banks.length === 0}
            >
              <option value="">Not linked</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}
    </FormDialog>
  );
}
