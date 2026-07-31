"use client";

import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { saveBankAccount } from "@/lib/accounts/actions";
import {
  BANK_ACCOUNT_TYPE_LABELS,
  type BankAccountView,
} from "@/lib/accounts/constants";

export function BankAccountDialog({
  initial,
  trigger,
  label,
}: {
  initial?: BankAccountView;
  trigger: "primary" | "icon";
  label: string;
}) {
  return (
    <FormDialog
      trigger={trigger}
      label={label}
      title={initial ? "Edit account" : "Add bank account"}
      submitLabel={initial ? "Save changes" : "Add account"}
      action={saveBankAccount}
    >
      {(state) => (
        <>
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <Field
            label="Bank name"
            htmlFor="bankName"
            error={state.fieldErrors?.bankName}
          >
            <Input
              id="bankName"
              name="bankName"
              defaultValue={initial?.bankName ?? ""}
              placeholder="HDFC Bank"
              autoComplete="off"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type" htmlFor="accountType">
              <select
                id="accountType"
                name="accountType"
                defaultValue={initial?.accountType ?? "SAVINGS"}
                className={selectClass}
              >
                {Object.entries(BANK_ACCOUNT_TYPE_LABELS).map(([v, l]) => (
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
              placeholder="Primary savings"
              autoComplete="off"
            />
          </Field>
          <Field
            label="Current balance (₹)"
            htmlFor="balanceInr"
            error={state.fieldErrors?.balanceInr}
          >
            <Input
              id="balanceInr"
              name="balanceInr"
              type="number"
              step="any"
              min="0"
              defaultValue={initial?.balanceInr ?? ""}
              placeholder="50000"
            />
          </Field>
          <details className="text-muted-foreground text-xs">
            <summary className="cursor-pointer select-none">
              Optional: full account details (encrypted)
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field
                label="Full account number"
                htmlFor="accountNumber"
                error={state.fieldErrors?.accountNumber}
              >
                <Input
                  id="accountNumber"
                  name="accountNumber"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Leave blank to keep unchanged"
                />
              </Field>
              <Field
                label="IFSC"
                htmlFor="ifsc"
                error={state.fieldErrors?.ifsc}
              >
                <Input
                  id="ifsc"
                  name="ifsc"
                  autoComplete="off"
                  placeholder="HDFC0001234"
                />
              </Field>
              <p>
                Stored with AES-256-GCM. Only masked •• last4 is shown in lists.
              </p>
            </div>
          </details>
        </>
      )}
    </FormDialog>
  );
}
