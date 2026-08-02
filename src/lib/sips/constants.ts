// Shared types and labels for SIP plans.
// This file is safe to import in client components (no Prisma dependency).

import type { SipFrequency } from "@/generated/prisma";

// The most recent debit applied to the holding automatically. Carried on the
// view so an automatic change to a money figure is always explained where the
// figure is shown.
export type SipAppliedView = {
  dueDate: Date;
  navDate: Date; // differs from dueDate when the debit hit a weekend or holiday
  nav: number;
  units: number;
  amountInr: number;
  debitedFrom: string | null; // bank the cash left, null when the plan is unlinked
};

// The account a SIP mandate debits, as shown in the dropdown and on the row.
export type SipBankView = {
  id: string;
  label: string; // e.g. "HDFC Bank ••4583"
};

export type SipView = {
  id: string;
  instrumentId: string;
  fundName: string;
  fundSymbol: string;
  amountInr: number;
  frequency: SipFrequency;
  dayOfMonth: number;
  nextDate: Date;
  active: boolean;
  source: string;
  bankAccountId: string | null;
  bankLabel: string | null;
  lastApplied: SipAppliedView | null;
};

/** "HDFC Bank ••4583", matching how accounts are masked everywhere else. */
export function bankLabel(bank: {
  bankName: string;
  nickname?: string | null;
  last4?: string | null;
}): string {
  const name = bank.nickname?.trim() || bank.bankName;
  return bank.last4 ? `${name} ••${bank.last4}` : name;
}

export const SIP_FREQUENCY_LABELS: Record<SipFrequency, string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};
