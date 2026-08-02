import { z } from "zod";

// A SIP is a recurring investment into a mutual fund. The user identifies the
// fund by symbol + name (an Instrument is found/created, like holdings).
export const sipSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "Symbol is required")
    .max(40)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, "Fund name is required").max(120),
  amountInr: z.coerce.number().positive("Amount must be greater than 0").finite(),
  frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]),
  dayOfMonth: z.coerce
    .number()
    .int()
    .min(1, "Day must be 1–31")
    .max(31, "Day must be 1–31"),
  source: z.string().trim().max(40).optional(),
  // The account the mandate debits. The empty string is what an unselected
  // <select> posts, so it is normalized to undefined rather than rejected.
  bankAccountId: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type SipValues = z.infer<typeof sipSchema>;

// Next occurrence (today or later) of the given day-of-month, clamped to month length.
/**
 * The next date on or after `from` whose day of month matches `dayOfMonth`,
 * clamped to the length of the month (a SIP on the 31st debits on the 30th in
 * April, and on the 28th or 29th in February).
 *
 * Built entirely in UTC. Constructing these at local midnight stored a time of
 * 18:30 the previous day for IST, which then rendered a day early on a UTC
 * server: a SIP on the 25th showed as the 24th in production.
 *
 * Note on cadence: only the day of month is stored, with no start date to
 * anchor from, so WEEKLY and QUARTERLY plans currently resolve to the same
 * monthly rule. Real cadence needs the transaction dates described in Phase 2
 * of PLAN.md.
 */
export function nextSipDate(dayOfMonth: number, from = new Date()): Date {
  const clampToMonth = (year: number, monthIndex: number) => {
    // Day 0 of the following month is the last day of this one.
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return Math.min(dayOfMonth, lastDay);
  };

  // Compare against today's date only, so a SIP due today still counts as due
  // today rather than rolling to next month.
  const todayUtc = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );

  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();

  const thisMonth = Date.UTC(y, m, clampToMonth(y, m));
  if (thisMonth >= todayUtc) return new Date(thisMonth);

  return new Date(Date.UTC(y, m + 1, clampToMonth(y, m + 1)));
}

/**
 * Every scheduled debit date in `(after, through]`, oldest first.
 *
 * Auto-apply works off this rather than off a single "most recent" date so a
 * cron that does not run for a fortnight catches up on both missed debits
 * instead of silently dropping one. Same month-length clamping as
 * `nextSipDate`, so a plan on the 31st debits on the 30th in April.
 *
 * `after` is exclusive: it is the last date already accounted for, so a debit
 * falling exactly on it is treated as already applied.
 */
export function dueDatesBetween(
  dayOfMonth: number,
  after: Date,
  through: Date,
): Date[] {
  if (after.getTime() >= through.getTime()) return [];

  const dates: Date[] = [];
  // Walk months from the one containing `after` to the one containing
  // `through`, so a long gap yields every debit in between.
  let y = after.getUTCFullYear();
  let m = after.getUTCMonth();
  const endY = through.getUTCFullYear();
  const endM = through.getUTCMonth();

  while (y < endY || (y === endY && m <= endM)) {
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const due = Date.UTC(y, m, Math.min(dayOfMonth, lastDay));
    if (due > after.getTime() && due <= through.getTime()) {
      dates.push(new Date(due));
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return dates;
}
