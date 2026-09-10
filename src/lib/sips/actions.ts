"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import type { FormActionState } from "@/lib/forms/action-state";
import { sipSchema, nextSipDate } from "./schema";
import { reverseSipExecution, type SipReverseResult } from "./reverse";

function revalidateSips() {
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  revalidatePath("/funds");
  // The linked account is shown on Accounts, and is what a debit draws down.
  revalidatePath("/accounts");
}

export async function saveSip(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = sipSchema.safeParse({
    type: formData.get("type") || undefined,
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    amountInr: formData.get("amountInr"),
    frequency: formData.get("frequency"),
    dayOfMonth: formData.get("dayOfMonth"),
    source: formData.get("source") || undefined,
    bankAccountId: formData.get("bankAccountId") || undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  const d = parsed.data;
  const source = d.source?.trim() || "MANUAL";

  // Never trust an id posted from the browser: a SIP must only ever be able to
  // debit an account this user owns.
  if (d.bankAccountId) {
    const owned = await prisma.bankAccount.findFirst({
      where: { id: d.bankAccountId, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return {
        status: "error",
        message: "That bank account was not found.",
        fieldErrors: { bankAccountId: ["Pick one of your accounts."] },
      };
    }
  }

  // Usually a mutual fund, but a listed stock or ETF (a gold ETF SIP, say)
  // uses the exact same schedule/amount shape: find/create that instrument.
  const instrument = await prisma.instrument.upsert({
    where: { type_symbol: { type: d.type, symbol: d.symbol } },
    create: {
      type: d.type,
      symbol: d.symbol,
      name: d.name,
      country: "IN",
      currency: "INR",
    },
    update: { name: d.name },
  });

  // nextSipDate needs applyFrom for QUARTERLY's phase (which three months of
  // the year it lands in). Editing keeps the existing plan's applyFrom
  // untouched on purpose — the comment below explains why — so it has to be
  // read back here rather than assumed, or an edited quarterly plan's phase
  // would silently shift to whatever month it happened to be edited in.
  let applyFrom: Date;
  if (id) {
    const owned = await prisma.sipPlan.findFirst({
      where: { id, userId: user.id },
    });
    if (!owned) return { status: "error", message: "SIP not found." };
    applyFrom = owned.applyFrom ?? new Date();
  } else {
    // Auto-apply starts from today, so a plan added now picks up its next debit
    // and never back-buys units the entered holding already contains. Past
    // debits are not recorded anywhere, so inventing them would be a guess.
    const now = new Date();
    applyFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }

  const data = {
    instrumentId: instrument.id,
    amountInr: new Prisma.Decimal(String(d.amountInr)),
    frequency: d.frequency,
    dayOfMonth: d.dayOfMonth,
    nextDate: nextSipDate(d.frequency, d.dayOfMonth, applyFrom),
    source,
    bankAccountId: d.bankAccountId ?? null,
  };

  if (id) {
    // applyFrom is deliberately not in `data`: editing the amount or the day
    // must not reset how far back auto-apply reaches.
    await prisma.sipPlan.update({ where: { id }, data });
  } else {
    await prisma.sipPlan.create({
      data: { ...data, userId: user.id, applyFrom },
    });
  }

  revalidateSips();
  return { status: "success" };
}

export async function deleteSip(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.sipPlan.deleteMany({ where: { id, userId: user.id } });
  revalidateSips();
}

/** Undoes the most recent debit on a SIP plan. See lib/sips/reverse.ts. */
export async function reverseSip(sipPlanId: string): Promise<SipReverseResult> {
  const user = await requireUser();
  const result = await reverseSipExecution(user.id!, sipPlanId);
  if (result.ok) revalidateSips();
  return result;
}
