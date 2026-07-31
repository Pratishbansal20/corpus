// Shared types and labels for credit cards: safe in client components.

import type { CardNetwork } from "@/generated/prisma";

export type CreditCardView = {
  id: string;
  issuer: string;
  network: CardNetwork;
  nickname: string | null;
  last4: string | null;
  creditLimit: number;
  currentOutstanding: number;
  statementDay: number | null;
  dueDay: number | null;
  currentDueDate: Date | null;
  utilizationPct: number;
};

export const CARD_NETWORK_LABELS: Record<CardNetwork, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  RUPAY: "RuPay",
  AMEX: "Amex",
  DINERS: "Diners Club",
  OTHER: "Other",
};
