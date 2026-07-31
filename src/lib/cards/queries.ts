import { prisma } from "@/lib/db/prisma";
import {
  type CreditCardView,
  CARD_NETWORK_LABELS,
} from "./constants";

export { type CreditCardView, CARD_NETWORK_LABELS } from "./constants";

export async function getCreditCards(
  userId: string,
): Promise<CreditCardView[]> {
  const rows = await prisma.creditCard.findMany({
    where: { userId },
    orderBy: [{ currentDueDate: "asc" }, { currentOutstanding: "desc" }],
  });
  return rows.map((c) => {
    const limit = c.creditLimit.toNumber();
    const out = c.currentOutstanding.toNumber();
    return {
      id: c.id,
      issuer: c.issuer,
      network: c.network,
      nickname: c.nickname,
      last4: c.last4,
      creditLimit: limit,
      currentOutstanding: out,
      statementDay: c.statementDay,
      dueDay: c.dueDay,
      currentDueDate: c.currentDueDate,
      utilizationPct: limit > 0 ? (out / limit) * 100 : 0,
    };
  });
}

export function sumOutstanding(cards: { currentOutstanding: number }[]): number {
  return cards.reduce((a, c) => a + c.currentOutstanding, 0);
}

// Calendar dates are held at UTC midnight and rendered with timeZone: "UTC",
// so a due date means the same day whether the code runs on a local IST
// machine or on Vercel. Building them at local midnight stored 18:30 the
// previous day for IST and rendered a day early on a UTC server.
function startOfDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

/** Next occurrence of `dueDay` (1 to 31) on or after today. */
export function computeNextDueDate(dueDay: number | null): Date | null {
  if (!dueDay) return null;
  const today = startOfDay(new Date());
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();

  // Day 0 of the next month is the last day of this one, so a card due on the
  // 31st falls on the 30th in April.
  const clamp = (year: number, monthIndex: number) =>
    Math.min(dueDay, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate());

  const thisMonth = new Date(Date.UTC(y, m, clamp(y, m)));
  if (thisMonth >= today) return thisMonth;
  return new Date(Date.UTC(y, m + 1, clamp(y, m + 1)));
}

/** Effective due date: explicit `currentDueDate`, else derived from `dueDay`. */
export function resolveDueDate(card: CreditCardView): Date | null {
  if (card.currentDueDate) return card.currentDueDate;
  return computeNextDueDate(card.dueDay);
}

export function daysUntilDue(card: CreditCardView): number | null {
  const due = resolveDueDate(card);
  if (!due) return null;
  const today = startOfDay(new Date());
  return Math.round(
    (startOfDay(due).getTime() - today.getTime()) / 86_400_000,
  );
}

export function isDueSoon(card: CreditCardView, withinDays = 7): boolean {
  const days = daysUntilDue(card);
  return days !== null && days >= 0 && days <= withinDays;
}

export function dueCards(
  cards: CreditCardView[],
  withinDays = 7,
): CreditCardView[] {
  return cards
    .filter((c) => c.currentOutstanding > 0 && isDueSoon(c, withinDays))
    .sort((a, b) => (daysUntilDue(a) ?? 99) - (daysUntilDue(b) ?? 99));
}
