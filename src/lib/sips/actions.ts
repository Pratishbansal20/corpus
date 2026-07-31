"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import type { FormActionState } from "@/lib/forms/action-state";
import { sipSchema, nextSipDate } from "./schema";

function revalidateSips() {
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
}

export async function saveSip(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const parsed = sipSchema.safeParse({
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    amountInr: formData.get("amountInr"),
    frequency: formData.get("frequency"),
    dayOfMonth: formData.get("dayOfMonth"),
    source: formData.get("source") || undefined,
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

  // SIPs are always into mutual funds: find/create that instrument.
  const instrument = await prisma.instrument.upsert({
    where: { type_symbol: { type: "MUTUAL_FUND", symbol: d.symbol } },
    create: {
      type: "MUTUAL_FUND",
      symbol: d.symbol,
      name: d.name,
      country: "IN",
      currency: "INR",
    },
    update: { name: d.name },
  });

  const data = {
    instrumentId: instrument.id,
    amountInr: new Prisma.Decimal(String(d.amountInr)),
    frequency: d.frequency,
    dayOfMonth: d.dayOfMonth,
    nextDate: nextSipDate(d.dayOfMonth),
    source,
  };

  if (id) {
    const owned = await prisma.sipPlan.findFirst({
      where: { id, userId: user.id },
    });
    if (!owned) return { status: "error", message: "SIP not found." };
    await prisma.sipPlan.update({ where: { id }, data });
  } else {
    await prisma.sipPlan.create({ data: { ...data, userId: user.id } });
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
