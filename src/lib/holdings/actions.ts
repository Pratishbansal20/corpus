"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { holdingFormSchema, deriveCountryCurrency } from "./schema";

export type HoldingActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

function parseForm(formData: FormData) {
  return holdingFormSchema.safeParse({
    type: formData.get("type"),
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    quantity: formData.get("quantity"),
    avgBuyPrice: formData.get("avgBuyPrice"),
    source: formData.get("source") || undefined,
    externalId: formData.get("externalId") ?? "",
  });
}

// Find-or-create the shared instrument for this (type, symbol), then return its id.
async function resolveInstrumentId(
  data: ReturnType<typeof holdingFormSchema.parse>,
) {
  const { country, currency } = deriveCountryCurrency(data.type);
  const externalId =
    data.type === "MUTUAL_FUND" && data.externalId?.trim()
      ? data.externalId.trim()
      : undefined;
  const instrument = await prisma.instrument.upsert({
    where: { type_symbol: { type: data.type, symbol: data.symbol } },
    create: {
      type: data.type,
      symbol: data.symbol,
      name: data.name,
      country,
      currency,
      externalId: externalId ?? null,
    },
    update: {
      name: data.name,
      ...(externalId !== undefined ? { externalId } : {}),
    },
  });
  return instrument.id;
}

export async function createHolding(
  _prev: HoldingActionState,
  formData: FormData,
): Promise<HoldingActionState> {
  const user = await requireUser();
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const source = data.source?.trim() || "MANUAL";
  const instrumentId = await resolveInstrumentId(data);

  // Upsert on (userId, instrumentId, source): adding the same instrument/source
  // updates the existing position rather than creating a duplicate.
  await prisma.holding.upsert({
    where: {
      userId_instrumentId_source: { userId: user.id, instrumentId, source },
    },
    create: {
      userId: user.id,
      instrumentId,
      source,
      quantity: new Prisma.Decimal(String(data.quantity)),
      avgBuyPrice: new Prisma.Decimal(String(data.avgBuyPrice)),
    },
    update: {
      quantity: new Prisma.Decimal(String(data.quantity)),
      avgBuyPrice: new Prisma.Decimal(String(data.avgBuyPrice)),
    },
  });

  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  return { status: "success" };
}

export async function updateHolding(
  _prev: HoldingActionState,
  formData: FormData,
): Promise<HoldingActionState> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { status: "error", message: "Missing holding id." };

  const parsed = parseForm(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  // Ownership check: never trust the id from the client.
  const existing = await prisma.holding.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { status: "error", message: "Holding not found." };

  const data = parsed.data;
  const source = data.source?.trim() || "MANUAL";
  const instrumentId = await resolveInstrumentId(data);

  try {
    await prisma.holding.update({
      where: { id },
      data: {
        instrumentId,
        source,
        quantity: new Prisma.Decimal(String(data.quantity)),
        avgBuyPrice: new Prisma.Decimal(String(data.avgBuyPrice)),
      },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return {
        status: "error",
        message: "You already have a holding for this instrument & source.",
      };
    }
    throw e;
  }

  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  return { status: "success" };
}

export async function deleteHolding(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // deleteMany with userId scoping = a no-op if the row isn't theirs.
  await prisma.holding.deleteMany({ where: { id, userId: user.id } });

  revalidatePath("/holdings");
  revalidatePath("/dashboard");
}
