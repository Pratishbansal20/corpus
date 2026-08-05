import { z } from "zod";

/**
 * Topping up a position you already hold.
 *
 * Editing a holding sets its quantity and average outright, which means a
 * lump-sum purchase forced the user to do the blend by hand: work out the units
 * the money bought, add them on, then recompute a weighted average across the
 * old and new cost. Getting it slightly wrong is invisible and permanent, and
 * it is the same arithmetic the SIP path already does correctly. A top-up is
 * additive instead: say what was bought, and the blend is done for you.
 *
 * Two ways to say it, matching how the two asset kinds are actually bought:
 *
 *   AMOUNT    a rupee figure, priced at the fund's NAV for the date. This is
 *             how a lump-sum mutual-fund purchase works: you send money, the
 *             units follow from that day's NAV.
 *   QUANTITY  a share count at a price per share, which is how an equity trade
 *             is confirmed.
 */
export const topUpSchema = z
  .object({
    holdingId: z.string().trim().min(1),
    mode: z.enum(["AMOUNT", "QUANTITY"]),
    // AMOUNT mode: rupees invested. The units follow from the NAV.
    amountInr: z.coerce.number().positive().finite().optional(),
    // QUANTITY mode: units bought and what each cost.
    quantity: z.coerce.number().positive().finite().optional(),
    pricePerUnit: z.coerce.number().positive().finite().optional(),
    // The purchase date, used to pick the NAV in AMOUNT mode.
    date: z.string().trim().optional(),
    // Optional: draw the money down from a bank account, as SIPs do.
    bankAccountId: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "AMOUNT" && !v.amountInr) {
      ctx.addIssue({
        code: "custom",
        path: ["amountInr"],
        message: "Enter the amount invested",
      });
    }
    if (v.mode === "QUANTITY") {
      if (!v.quantity) {
        ctx.addIssue({
          code: "custom",
          path: ["quantity"],
          message: "Enter how many units you bought",
        });
      }
      if (!v.pricePerUnit) {
        ctx.addIssue({
          code: "custom",
          path: ["pricePerUnit"],
          message: "Enter the price you paid per unit",
        });
      }
    }
  });

export type TopUpValues = z.infer<typeof topUpSchema>;

/**
 * A calendar date at UTC midnight, matching how every other date in the app is
 * stored. Built with Date.UTC rather than local midnight, which under IST would
 * store 18:30 the previous day and pick the wrong NAV.
 */
export function parseUtcDate(value: string | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}
