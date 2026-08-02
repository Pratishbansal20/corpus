import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import {
  fetchNavHistory,
  resolveAllotmentNav,
  type NavHistory,
} from "@/lib/portfolio/providers/mfapi-nav-history";
import { dueDatesBetween } from "./schema";
import { blendedAverage, unitsForAmount } from "./math";

/**
 * Applying SIP debits to holdings.
 *
 * A SipPlan only ever stored a schedule, so nothing added the purchased units
 * to the Holding. Every debit left the app understating units and invested
 * until the position was edited by hand, which is how the numbers drifted about
 * ₹7,000 below reality by 31 Jul 2026.
 *
 * Two dates matter here and they are not the same one:
 *
 *   dueDate  the scheduled debit, "the 4th of the month"
 *   navDate  the day the units were actually allotted, which is the first day
 *            AMFI published a NAV on or after the debit
 *
 * They diverge whenever the debit lands on a weekend or a public holiday. The
 * roll is read off the fund's published NAV series rather than a hardcoded
 * holiday calendar, so it stays correct when a holiday moves date year to year,
 * when a new one is added, or when the exchange closes unexpectedly.
 */

/** Why a plan produced no execution on this run. Reported, never silent. */
export type SipSkipReason =
  | "NOT_MONTHLY" // cadence has no anchor date, applying it would over-buy
  | "NO_START_DATE" // applyFrom unset: refuse to guess how far back to go
  | "NO_SCHEME_CODE" // instrument has no AMFI code, so no NAV history
  | "NAV_NOT_PUBLISHED" // debit is due but its NAV does not exist yet: retry
  | "NAV_FETCH_FAILED";

export type SipApplyResult = {
  applied: number;
  unitsByPlan: {
    sipPlanId: string;
    fundName: string;
    dueDate: string;
    navDate: string;
    nav: number;
    units: number;
    amountInr: number;
    debitedFrom: string | null; // bank the cash left, null when unlinked
  }[];
  skipped: { sipPlanId: string; fundName: string; reason: SipSkipReason }[];
  errors: string[];
};

/** Today at UTC midnight, matching how every other date in the app is stored. */
function utcToday(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Apply every SIP debit that has come due and has not been applied yet.
 *
 * Idempotent by construction: each execution is keyed on (sipPlanId, dueDate)
 * and written in the same transaction as the holding update, so a cron that
 * runs twice, or overlaps itself, cannot buy the same units twice. If the
 * insert loses a race the whole transaction rolls back and the holding is
 * untouched.
 */
export async function applyDueSips(now = new Date()): Promise<SipApplyResult> {
  const result: SipApplyResult = {
    applied: 0,
    unitsByPlan: [],
    skipped: [],
    errors: [],
  };

  const plans = await prisma.sipPlan.findMany({
    where: { active: true, autoApply: true },
    include: { instrument: true, bankAccount: true },
  });
  if (plans.length === 0) return result;

  const through = utcToday(now);
  // One fetch per fund per run, shared across that fund's due dates.
  const historyCache = new Map<string, NavHistory | null>();

  async function historyFor(schemeCode: string): Promise<NavHistory | null> {
    if (historyCache.has(schemeCode)) return historyCache.get(schemeCode)!;
    try {
      const h = await fetchNavHistory(schemeCode);
      historyCache.set(schemeCode, h);
      return h;
    } catch (e) {
      historyCache.set(schemeCode, null);
      result.errors.push(
        `NAV history ${schemeCode}: ${e instanceof Error ? e.message : "fetch failed"}`,
      );
      return null;
    }
  }

  for (const plan of plans) {
    const fundName = plan.instrument.name;
    const skip = (reason: SipSkipReason) =>
      result.skipped.push({ sipPlanId: plan.id, fundName, reason });

    // Only day-of-month is stored, with no start date to anchor a cadence from,
    // so a weekly or quarterly plan cannot be resolved to real debit dates.
    // Generating monthly dates for a quarterly plan would buy three times the
    // units, so those are left for the transaction model in Phase 2.
    if (plan.frequency !== "MONTHLY") {
      skip("NOT_MONTHLY");
      continue;
    }

    // The last debit already reflected in the holding. Executions win once they
    // exist; before that it is applyFrom, the date the position was reconciled
    // against the broker. With neither, refuse: walking back to createdAt would
    // re-buy units that the reconciled quantity already contains.
    const lastExecution = await prisma.sipExecution.findFirst({
      where: { sipPlanId: plan.id },
      orderBy: { dueDate: "desc" },
    });
    const after = lastExecution?.dueDate ?? plan.applyFrom;
    if (!after) {
      skip("NO_START_DATE");
      continue;
    }

    const dueDates = dueDatesBetween(plan.dayOfMonth, after, through);
    if (dueDates.length === 0) continue;

    const schemeCode = plan.instrument.externalId;
    if (!schemeCode) {
      skip("NO_SCHEME_CODE");
      continue;
    }

    const history = await historyFor(schemeCode);
    if (!history) {
      skip("NAV_FETCH_FAILED");
      continue;
    }

    for (const dueDate of dueDates) {
      const allotment = resolveAllotmentNav(history, dueDate);
      if (!allotment) {
        // Normal on the day of a debit before the evening NAV upload, and over
        // a weekend that has not reached the next business day. Leave the plan
        // alone and retry tomorrow rather than reaching back for a stale price.
        // Later due dates cannot resolve either, so stop this plan here and
        // keep the debits in order: applying out of order corrupts the average.
        skip("NAV_NOT_PUBLISHED");
        break;
      }

      try {
        const applied = await applyOneDebit(plan, dueDate, allotment);
        result.applied += 1;
        result.unitsByPlan.push({
          sipPlanId: plan.id,
          fundName,
          dueDate: dueDate.toISOString().slice(0, 10),
          navDate: allotment.navDate,
          nav: allotment.nav,
          units: applied.units,
          amountInr: plan.amountInr.toNumber(),
          debitedFrom: plan.bankAccount
            ? `${plan.bankAccount.bankName}${
                plan.bankAccount.last4 ? ` ••${plan.bankAccount.last4}` : ""
              }`
            : null,
        });
      } catch (e) {
        // A unique-key collision means a concurrent run already applied this
        // debit, which is the safeguard working, not a failure.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        result.errors.push(
          `${fundName} ${dueDate.toISOString().slice(0, 10)}: ${
            e instanceof Error ? e.message : "apply failed"
          }`,
        );
        break;
      }
    }
  }

  return result;
}

type PlanWithInstrument = Prisma.SipPlanGetPayload<{
  include: { instrument: true; bankAccount: true };
}>;

/**
 * Add one debit's units to the holding and record the execution, atomically.
 *
 * The new average is computed from money in, not from the rounded unit count:
 * (old invested + amount) / new quantity. That keeps invested exactly equal to
 * the rupees actually debited, which is the figure the user can check against a
 * bank statement.
 */
async function applyOneDebit(
  plan: PlanWithInstrument,
  dueDate: Date,
  allotment: { navDate: string; nav: number },
): Promise<{ units: number }> {
  const nav = new Prisma.Decimal(String(allotment.nav));
  const amount = plan.amountInr;
  const units = unitsForAmount(amount, nav);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.holding.findUnique({
      where: {
        userId_instrumentId_source: {
          userId: plan.userId,
          instrumentId: plan.instrumentId,
          source: plan.source,
        },
      },
    });

    if (existing) {
      await tx.holding.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity.plus(units),
          avgBuyPrice: blendedAverage(
            existing.quantity,
            existing.avgBuyPrice,
            units,
            amount,
          ),
        },
      });
    } else {
      // First debit into a fund with no position yet: the average is the NAV
      // the units were bought at.
      await tx.holding.create({
        data: {
          userId: plan.userId,
          instrumentId: plan.instrumentId,
          quantity: units,
          avgBuyPrice: nav,
          source: plan.source,
        },
      });
    }

    // The cash side. A SIP is a transfer, not income: the same rupees leave the
    // bank and arrive as units, so net worth is unchanged and only its
    // composition moves. Debiting in this transaction means the balance and the
    // units can never disagree, and the execution row records which account it
    // came from so a wrong one can be traced and undone.
    //
    // The balance is deliberately allowed to go negative. It is a figure the
    // user maintains by hand, so a shortfall means it has gone stale, and
    // hiding that by clamping would be the same class of silent drift this
    // feature exists to remove.
    if (plan.bankAccountId) {
      await tx.bankAccount.update({
        where: { id: plan.bankAccountId },
        data: {
          balanceInr: { decrement: amount },
          // The money leaves on the debit date, not the allotment date. Never
          // move asOf backwards: it marks how current the balance is.
          asOf: dueDate > plan.bankAccount!.asOf ? dueDate : undefined,
        },
      });
    }

    await tx.sipExecution.create({
      data: {
        sipPlanId: plan.id,
        dueDate,
        navDate: new Date(`${allotment.navDate}T00:00:00.000Z`),
        amountInr: amount,
        navUsed: nav,
        unitsAdded: units,
        navSource: "MFAPI",
        bankAccountId: plan.bankAccountId,
        bankDebitedInr: plan.bankAccountId ? amount : null,
      },
    });

    return { units: units.toNumber() };
  });
}
