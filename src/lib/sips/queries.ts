import { prisma } from "@/lib/db/prisma";

// Re-export shared types and labels so server-side callers that already
// import from this file continue to work without changing their imports.
export {
  type SipView,
  type SipAppliedView,
  type SipBankView,
  SIP_FREQUENCY_LABELS,
} from "./constants";

import type { SipBankView, SipView } from "./constants";
import { bankLabel } from "./constants";
import { nextSipDate } from "./schema";

/** The accounts a SIP can be pointed at, for the "Debit from" dropdown. */
export async function getSipBankOptions(
  userId: string,
): Promise<SipBankView[]> {
  const rows = await prisma.bankAccount.findMany({
    where: { userId },
    orderBy: { balanceInr: "desc" },
    select: { id: true, bankName: true, nickname: true, last4: true },
  });
  return rows.map((b) => ({ id: b.id, label: bankLabel(b) }));
}

export async function getSipPlans(userId: string): Promise<SipView[]> {
  const rows = await prisma.sipPlan.findMany({
    where: { userId },
    include: {
      instrument: true,
      bankAccount: true,
      // Just the latest applied debit: enough to explain the current units.
      executions: {
        orderBy: { dueDate: "desc" },
        take: 1,
        include: { bankAccount: true },
      },
    },
  });

  // The stored nextDate is only written when a plan is created or edited, so it
  // goes stale the moment that date passes: every SIP showed a date in the past.
  // Derive it from dayOfMonth on every read instead, which cannot drift, and
  // sort on the derived value. The cron also rolls the stored column forward so
  // the database stays consistent for anything reading it directly.
  return rows
    .map((s) => {
      const last = s.executions[0];
      return {
        id: s.id,
        instrumentId: s.instrumentId,
        fundName: s.instrument.name,
        fundSymbol: s.instrument.symbol,
        amountInr: s.amountInr.toNumber(),
        frequency: s.frequency,
        dayOfMonth: s.dayOfMonth,
        nextDate: nextSipDate(s.dayOfMonth),
        active: s.active,
        source: s.source,
        bankAccountId: s.bankAccountId,
        bankLabel: s.bankAccount ? bankLabel(s.bankAccount) : null,
        lastApplied: last
          ? {
              dueDate: last.dueDate,
              navDate: last.navDate,
              nav: last.navUsed.toNumber(),
              units: last.unitsAdded.toNumber(),
              amountInr: last.amountInr.toNumber(),
              // Read off the execution, not the plan: re-pointing the SIP later
              // must not rewrite where past debits came from.
              debitedFrom: last.bankAccount
                ? bankLabel(last.bankAccount)
                : null,
            }
          : null,
      };
    })
    .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
}

/**
 * Roll every stored nextDate forward to its next occurrence. Called from the
 * daily cron so the persisted column matches what the app derives on read.
 */
export async function rollForwardSipDates(): Promise<number> {
  const rows = await prisma.sipPlan.findMany({
    select: { id: true, dayOfMonth: true, nextDate: true },
  });

  let updated = 0;
  for (const s of rows) {
    const next = nextSipDate(s.dayOfMonth);
    if (next.getTime() !== s.nextDate.getTime()) {
      await prisma.sipPlan.update({
        where: { id: s.id },
        data: { nextDate: next },
      });
      updated++;
    }
  }
  return updated;
}

// Total monthly SIP commitment (active monthly plans only).
export function monthlySipTotal(sips: SipView[]): number {
  return sips
    .filter((s) => s.active && s.frequency === "MONTHLY")
    .reduce((a, s) => a + s.amountInr, 0);
}
