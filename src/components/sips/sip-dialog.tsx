"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { saveSip } from "@/lib/sips/actions";
import {
  SIP_FREQUENCY_LABELS,
  type SipBankView,
  type SipFrequency,
  type SipView,
} from "@/lib/sips/constants";

const SOURCES = ["MANUAL", "GROWW", "PAYTM_MONEY", "INDMONEY"] as const;

// dayOfMonth doubles as day-of-week for WEEKLY (0 Sun .. 6 Sat, JS's own
// getUTCDay() convention — see lib/sips/schema.ts) so no separate column was
// needed, but a 1–31 number input makes no sense for "which weekday": WEEKLY
// gets its own picker instead, same underlying field.
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

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
  const [frequency, setFrequency] = useState<SipFrequency>(
    initial?.frequency ?? "MONTHLY",
  );
  const [type, setType] = useState<"MUTUAL_FUND" | "IN_STOCK">(
    initial?.instrumentType === "IN_STOCK" ? "IN_STOCK" : "MUTUAL_FUND",
  );

  return (
    <FormDialog
      trigger={trigger}
      label={label}
      title={initial ? "Edit SIP" : "Add SIP"}
      description="A recurring investment into a mutual fund, stock, or ETF."
      submitLabel={initial ? "Save changes" : "Add SIP"}
      action={saveSip}
    >
      {(state) => (
        <>
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="type">
              <select
                id="type"
                name="type"
                value={type}
                onChange={(e) =>
                  setType(e.target.value as "MUTUAL_FUND" | "IN_STOCK")
                }
                className={selectClass}
              >
                <option value="MUTUAL_FUND">Mutual fund</option>
                <option value="IN_STOCK">Stock / ETF</option>
              </select>
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
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={type === "IN_STOCK" ? "Ticker" : "Fund symbol"}
              htmlFor="symbol"
              error={state.fieldErrors?.symbol}
            >
              <Input
                id="symbol"
                name="symbol"
                defaultValue={initial?.fundSymbol ?? ""}
                placeholder={type === "IN_STOCK" ? "GOLDBEES" : "PPFAS_FLEXI"}
                autoComplete="off"
              />
            </Field>
            <Field
              label={type === "IN_STOCK" ? "Name" : "Fund name"}
              htmlFor="name"
              error={state.fieldErrors?.name}
            >
              <Input
                id="name"
                name="name"
                defaultValue={initial?.fundName ?? ""}
                placeholder={
                  type === "IN_STOCK" ? "UTI Gold ETF" : "Parag Parikh Flexi Cap"
                }
                autoComplete="off"
              />
            </Field>
          </div>
          {type === "IN_STOCK" && (
            <p className="text-muted-foreground -mt-1 text-xs">
              Units aren&apos;t auto-applied for stock/ETF SIPs yet — update
              the holding by hand after each debit.
            </p>
          )}
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
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as SipFrequency)}
                className={selectClass}
              >
                {Object.entries(SIP_FREQUENCY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {frequency === "WEEKLY" ? (
              <Field
                label="Day of week"
                htmlFor="dayOfMonth"
                error={state.fieldErrors?.dayOfMonth}
              >
                <select
                  id="dayOfMonth"
                  name="dayOfMonth"
                  defaultValue={
                    initial?.frequency === "WEEKLY" ? initial.dayOfMonth : ""
                  }
                  className={selectClass}
                >
                  <option value="" disabled>
                    Pick a day
                  </option>
                  {WEEKDAYS.map((label, i) => (
                    <option key={i} value={i}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field
                label="Day of month"
                htmlFor="dayOfMonth"
                error={state.fieldErrors?.dayOfMonth}
                hint={
                  frequency === "QUARTERLY"
                    ? "Every 3rd month from when this plan is saved."
                    : undefined
                }
              >
                <Input
                  id="dayOfMonth"
                  name="dayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  defaultValue={
                    initial && initial.frequency !== "WEEKLY"
                      ? initial.dayOfMonth
                      : ""
                  }
                  placeholder="5"
                />
              </Field>
            )}
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
