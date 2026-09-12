import type { Prisma, TransactionType } from "@/generated/prisma";

// The one place every money-moving action writes its Transaction row from,
// so "what fields does a BUY need" is answered once. Not a "use server"
// action itself - every caller already holds its own requireUser() result and
// its own $transaction client, and calls this from inside it so the ledger
// row can never commit without the Holding update it describes, or vice
// versa. No queries.ts/actions.ts/UI yet: this domain exists today only to be
// written to and later read by XIRR/CSV-import/dividend-tracking, all still
// ahead in TODO.md.
export type RecordTransactionInput = {
  userId: string;
  instrumentId: string;
  // Which specific Holding this cash flow belongs to. The same instrument can
  // sit under two different (userId, instrumentId, source) Holdings at once
  // (an instrument held via two brokers), so a per-holding reader (XIRR) must
  // not have to guess which Holding a row belongs to.
  holdingId?: string | null;
  type?: TransactionType;
  quantity: Prisma.Decimal;
  pricePerUnit?: Prisma.Decimal | null;
  amount: Prisma.Decimal;
  fees?: Prisma.Decimal;
  date: Date;
  source: string;
  folio?: string;
  importRef?: string;
  notes?: string;
};

export function recordTransaction(
  tx: Prisma.TransactionClient,
  input: RecordTransactionInput,
) {
  return tx.transaction.create({
    data: {
      userId: input.userId,
      instrumentId: input.instrumentId,
      holdingId: input.holdingId ?? null,
      type: input.type ?? "BUY",
      quantity: input.quantity,
      pricePerUnit: input.pricePerUnit ?? null,
      amount: input.amount,
      fees: input.fees,
      date: input.date,
      source: input.source,
      folio: input.folio,
      importRef: input.importRef,
      notes: input.notes,
    },
  });
}
