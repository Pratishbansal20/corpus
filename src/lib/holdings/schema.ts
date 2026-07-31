import { z } from "zod";
import type { Country, InstrumentType } from "@/generated/prisma";

// Manual-entry / edit form. quantity & avgBuyPrice are coerced from strings
// (form fields) and must be positive. symbol is normalized to uppercase so the
// same instrument always resolves to one row.
export const holdingFormSchema = z.object({
  type: z.enum(["IN_STOCK", "MUTUAL_FUND", "US_STOCK"]),
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(40)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, "Name is required").max(120),
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .finite(),
  avgBuyPrice: z.coerce
    .number()
    .positive("Average price must be greater than 0")
    .finite(),
  source: z.string().trim().max(40).optional(),
  externalId: z.string().trim().max(20).optional().or(z.literal("")),
});

export type HoldingFormValues = z.infer<typeof holdingFormSchema>;

// Country and native currency are derived from the asset type: the user never
// has to pick them, which keeps allocation tagging cheap and consistent.
export function deriveCountryCurrency(type: InstrumentType): {
  country: Country;
  currency: string;
} {
  if (type === "US_STOCK") return { country: "US", currency: "USD" };
  return { country: "IN", currency: "INR" };
}

export const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  IN_STOCK: "Indian Stock",
  MUTUAL_FUND: "Mutual Fund",
  US_STOCK: "US Stock",
};
