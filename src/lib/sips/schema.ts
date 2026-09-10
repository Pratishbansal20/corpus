import { z } from "zod";

// A SIP is usually a recurring investment into a mutual fund, but a listed
// stock or ETF (e.g. a gold ETF bought on a fixed schedule) is the same
// shape of commitment, just against a different Instrument type. The user
// identifies the target by symbol + name (an Instrument is found/created,
// like holdings); MUTUAL_FUND is the default since that is still the common
// case.
export const sipSchema = z
  .object({
    type: z.enum(["MUTUAL_FUND", "IN_STOCK"]).default("MUTUAL_FUND"),
    symbol: z
      .string()
      .trim()
      .min(1, "Symbol is required")
      .max(40)
      .transform((s) => s.toUpperCase()),
    name: z.string().trim().min(1, "Fund name is required").max(120),
    amountInr: z.coerce.number().positive("Amount must be greater than 0").finite(),
    frequency: z.enum(["WEEKLY", "MONTHLY", "QUARTERLY"]),
    // Contextual meaning, not a schema-level ambiguity: for WEEKLY this is a
    // day of week (0 Sun – 6 Sat, JS's own getUTCDay() convention, chosen so
    // the date math below never needs a translation table); for MONTHLY and
    // QUARTERLY it's a day of month (1–31). One column carries both so a
    // weekly plan needs no schema field a monthly one leaves unused, and vice
    // versa.
    dayOfMonth: z.coerce.number().int(),
    source: z.string().trim().max(40).optional(),
    // The account the mandate debits. The empty string is what an unselected
    // <select> posts, so it is normalized to undefined rather than rejected.
    bankAccountId: z
      .string()
      .trim()
      .max(40)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .superRefine((d, ctx) => {
    if (d.frequency === "WEEKLY") {
      if (d.dayOfMonth < 0 || d.dayOfMonth > 6) {
        ctx.addIssue({
          code: "custom",
          path: ["dayOfMonth"],
          message: "Pick a day of the week",
        });
      }
    } else if (d.dayOfMonth < 1 || d.dayOfMonth > 31) {
      ctx.addIssue({
        code: "custom",
        path: ["dayOfMonth"],
        message: "Day must be 1–31",
      });
    }
  });

export type SipValues = z.infer<typeof sipSchema>;

export type SipCadence = "WEEKLY" | "MONTHLY" | "QUARTERLY";

const DAY_MS = 86_400_000;

/** The day of month a given (year, monthIndex) actually has, clamped. */
function clampToMonth(dayOfMonth: number, year: number, monthIndex: number): number {
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(dayOfMonth, lastDay);
}

/**
 * Whether `monthIndex` is one of the three-month cycle `anchorMonthIndex`
 * belongs to. A QUARTERLY plan created in March debits in March, June,
 * September and December; one created in April debits in April, July,
 * October and January. The anchor is the plan's own `applyFrom` (the date
 * auto-apply starts from, already stored for every plan), not a new field:
 * whichever month the plan was actually set up in becomes its permanent
 * phase, the same way its day-of-month already does.
 */
function monthQualifiesForQuarter(monthIndex: number, anchorMonthIndex: number): boolean {
  return ((monthIndex - anchorMonthIndex) % 3 + 3) % 3 === 0;
}

/**
 * The next date on or after `from` this plan debits on.
 *
 * Built entirely in UTC. Constructing these at local midnight stored a time of
 * 18:30 the previous day for IST, which then rendered a day early on a UTC
 * server: a SIP on the 25th showed as the 24th in production.
 *
 * MONTHLY clamps `dayOfMonth` to the length of the month (the 31st lands on
 * the 30th in April). QUARTERLY does the same, but only in months that match
 * `applyFrom`'s phase. WEEKLY ignores month/day arithmetic entirely and just
 * walks forward to the next matching day of week.
 */
export function nextSipDate(
  frequency: SipCadence,
  dayOfMonth: number,
  applyFrom: Date | null,
  from = new Date(),
): Date {
  // Compare against today's date only, so a SIP due today still counts as due
  // today rather than rolling to next month/week.
  const todayUtc = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );

  if (frequency === "WEEKLY") {
    const targetDow = dayOfMonth;
    for (let i = 0; i < 7; i++) {
      const candidate = todayUtc + i * DAY_MS;
      if (new Date(candidate).getUTCDay() === targetDow) return new Date(candidate);
    }
    return new Date(todayUtc); // unreachable: one of the next 7 days always matches
  }

  const anchorMonthIndex = (applyFrom ?? from).getUTCMonth();
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();

  // At most a year of months to search: a quarterly plan qualifies at least
  // four times in that span, monthly every time.
  for (let i = 0; i < 12; i++) {
    if (frequency === "MONTHLY" || monthQualifiesForQuarter(m, anchorMonthIndex)) {
      const candidate = Date.UTC(y, m, clampToMonth(dayOfMonth, y, m));
      if (candidate >= todayUtc) return new Date(candidate);
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return new Date(todayUtc); // unreachable
}

/**
 * Every scheduled debit date in `(after, through]`, oldest first.
 *
 * Auto-apply works off this rather than off a single "most recent" date so a
 * cron that does not run for a fortnight catches up on every missed debit
 * instead of silently dropping one.
 *
 * `after` is exclusive: it is the last date already accounted for, so a debit
 * falling exactly on it is treated as already applied.
 */
export function dueDatesBetween(
  frequency: SipCadence,
  dayOfMonth: number,
  applyFrom: Date | null,
  after: Date,
  through: Date,
): Date[] {
  if (after.getTime() >= through.getTime()) return [];

  if (frequency === "WEEKLY") {
    const targetDow = dayOfMonth;
    const dates: Date[] = [];
    for (let t = after.getTime() + DAY_MS; t <= through.getTime(); t += DAY_MS) {
      if (new Date(t).getUTCDay() === targetDow) dates.push(new Date(t));
    }
    return dates;
  }

  const anchorMonthIndex = (applyFrom ?? after).getUTCMonth();
  const dates: Date[] = [];
  // Walk months from the one containing `after` to the one containing
  // `through`, so a long gap yields every debit in between.
  let y = after.getUTCFullYear();
  let m = after.getUTCMonth();
  const endY = through.getUTCFullYear();
  const endM = through.getUTCMonth();

  while (y < endY || (y === endY && m <= endM)) {
    if (frequency === "MONTHLY" || monthQualifiesForQuarter(m, anchorMonthIndex)) {
      const due = Date.UTC(y, m, clampToMonth(dayOfMonth, y, m));
      if (due > after.getTime() && due <= through.getTime()) {
        dates.push(new Date(due));
      }
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }

  return dates;
}
