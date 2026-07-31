"use client";

import { Input } from "@/components/ui/input";
import { Field, selectClass } from "@/components/forms/fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { saveManualAsset } from "@/lib/accounts/actions";
import {
  ASSET_CATEGORY_LABELS,
  type ManualAssetView,
} from "@/lib/accounts/constants";

export function ManualAssetDialog({
  initial,
  trigger,
  label,
}: {
  initial?: ManualAssetView;
  trigger: "primary" | "icon";
  label: string;
}) {
  return (
    <FormDialog
      trigger={trigger}
      label={label}
      title={initial ? "Edit asset" : "Add asset"}
      description="Cash, FDs, gold, EPF/PPF, property, and anything that adds to net worth."
      submitLabel={initial ? "Save changes" : "Add asset"}
      action={saveManualAsset}
    >
      {(state) => (
        <>
          {initial && <input type="hidden" name="id" value={initial.id} />}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Name"
              htmlFor="name"
              error={state.fieldErrors?.name}
            >
              <Input
                id="name"
                name="name"
                defaultValue={initial?.name ?? ""}
                placeholder="Emergency fund"
                autoComplete="off"
              />
            </Field>
            <Field label="Category" htmlFor="category">
              <select
                id="category"
                name="category"
                defaultValue={initial?.category ?? "CASH"}
                className={selectClass}
              >
                {Object.entries(ASSET_CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field
            label="Value (₹)"
            htmlFor="valueInr"
            error={state.fieldErrors?.valueInr}
          >
            <Input
              id="valueInr"
              name="valueInr"
              type="number"
              step="any"
              min="0"
              defaultValue={initial?.valueInr ?? ""}
              placeholder="100000"
            />
          </Field>
          <Field label="Notes (optional)" htmlFor="notes">
            <Input
              id="notes"
              name="notes"
              defaultValue={initial?.notes ?? ""}
              placeholder="Maturity Mar 2027"
              autoComplete="off"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
