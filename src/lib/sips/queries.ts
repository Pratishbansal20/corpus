import { prisma } from "@/lib/db/prisma";

// Re-export shared types and labels so server-side callers that already
// import from this file continue to work without changing their imports.
export {
  type SipView,
  SIP_FREQUENCY_LABELS,
} from "./constants";

import type { SipView } from "./constants";
import { nextSipDate } from "./schema";

export async function getSipPlans(userId: string): Promise<SipView[]> {
  const rows = await prisma.sipPlan.findMany({
    where: { userId },
    include: { instrument: true },
  });

  // The stored nextDate is only written when a plan is created or edited, so it
  // goes stale the moment that date passes: every SIP showed a date in the past.
  // Derive it from dayOfMonth on every read instead, which cannot drift, and
  // sort on the derived value. The cron also rolls the stored column forward so
  // the database stays consistent for anything reading it directly.
  return rows
    .map((s) => ({
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
    }))
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
