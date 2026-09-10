import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { UNIT_SCALE } from "./math";

/**
 * Undoing a SIP debit — a bounced mandate, or one applied by mistake.
 *
 * Only the most recent, not-yet-reversed execution for a plan is ever
 * eligible. This isn't an arbitrary restriction: `Holding.quantity` and
 * `avgBuyPrice` are running totals, not a ledger (that's the Transaction
 * model this app doesn't have yet), so undoing an *older* execution while
 * newer ones sit on top of it would need to replay every debit since in
 * order, and there is no stored order to replay — only the current total.
 * Reversing the most recent one is the one case where "subtract exactly what
 * this execution added" is unambiguous regardless of that.
 *
 * The invested-money identity this relies on: `avgBuyPrice = invested /
 * quantity` holds for every holding this app writes to (SIP debits, top-ups,
 * new positions), because both write paths compute the average from money in
 * rather than from a rounded unit count. It would only be wrong if the
 * holding had been directly overwritten by hand (the "Edit" dialog sets
 * values outright rather than blending) after this execution applied — a
 * real, if unlikely, edge case with no ledger to catch it, same class of gap
 * as everywhere else in this app that pre-dates a real transaction history.
 */
export type SipReverseResult =
  | { ok: true; unitsRemoved: number; amountInr: number }
  | { ok: false; reason: string };

export async function reverseSipExecution(
  userId: string,
  sipPlanId: string,
): Promise<SipReverseResult> {
  const plan = await prisma.sipPlan.findFirst({
    where: { id: sipPlanId, userId },
  });
  if (!plan) return { ok: false, reason: "SIP not found." };

  return prisma.$transaction(async (tx) => {
    const latest = await tx.sipExecution.findFirst({
      where: { sipPlanId },
      orderBy: { dueDate: "desc" },
    });
    if (!latest) return { ok: false, reason: "No debit to reverse." };
    if (latest.reversedAt) {
      return { ok: false, reason: "That debit was already reversed." };
    }

    const holding = await tx.holding.findUnique({
      where: {
        userId_instrumentId_source: {
          userId: plan.userId,
          instrumentId: plan.instrumentId,
          source: plan.source,
        },
      },
    });
    if (!holding) {
      return {
        ok: false,
        reason: "The holding this SIP feeds no longer exists.",
      };
    }

    const newQuantity = holding.quantity.sub(latest.unitsAdded);
    if (newQuantity.isNegative()) {
      return {
        ok: false,
        reason:
          "The holding has fewer units than this debit added — it's likely been edited by hand since. Fix the holding directly instead.",
      };
    }

    // A holding fully unwound to zero units: the average no longer means
    // anything (investedInr = quantity × avgBuyPrice is 0 either way), so
    // there's nothing to divide by and nothing worth computing.
    const newAvgBuyPrice = newQuantity.isZero()
      ? new Prisma.Decimal(0)
      : holding.quantity
          .mul(holding.avgBuyPrice)
          .sub(latest.amountInr)
          .div(newQuantity)
          .toDecimalPlaces(UNIT_SCALE);

    await tx.holding.update({
      where: { id: holding.id },
      data: { quantity: newQuantity, avgBuyPrice: newAvgBuyPrice },
    });

    // The cash side, symmetric with applyOneDebit's decrement: the same
    // rupees that left the bank come back, in the same transaction as the
    // units leaving the holding, so the two can never disagree.
    if (latest.bankAccountId && latest.bankDebitedInr) {
      await tx.bankAccount.update({
        where: { id: latest.bankAccountId },
        data: { balanceInr: { increment: latest.bankDebitedInr } },
      });
    }

    // The row stays — see the module comment on SipExecution.reversedAt in
    // schema.prisma for why this isn't a delete.
    await tx.sipExecution.update({
      where: { id: latest.id },
      data: { reversedAt: new Date() },
    });

    return {
      ok: true,
      unitsRemoved: latest.unitsAdded.toNumber(),
      amountInr: latest.amountInr.toNumber(),
    };
  });
}
