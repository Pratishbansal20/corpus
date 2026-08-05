"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { holdingFormSchema, deriveCountryCurrency } from "./schema";
import { topUpSchema, parseUtcDate } from "./topup";
import { blendedAverage, unitsForAmount } from "@/lib/sips/math";
import {
  fetchNavHistory,
  resolveAllotmentNav,
} from "@/lib/portfolio/providers/mfapi-nav-history";

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

  // A fund's real identity is its AMFI scheme code, not its symbol: the seeded
  // funds carry hand-made symbols like JIOBR_FLEXI while search offers MF153859
  // for the very same scheme. Matching on the code first means picking a fund
  // from search tops up the position already held instead of quietly opening a
  // second one beside it.
  if (externalId) {
    const bySchemeCode = await prisma.instrument.findFirst({
      where: { type: "MUTUAL_FUND", externalId },
    });
    if (bySchemeCode) return bySchemeCode.id;
  }

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

/**
 * Add a purchase to a position already held, blending the average for you.
 *
 * The whole point is that nothing here is recomputed by hand. In AMOUNT mode
 * the units come from the fund's NAV on the purchase date, using the same
 * published-series lookup the SIP path uses, so a date that lands on a weekend
 * or a public holiday resolves to the next NAV actually published rather than
 * being priced off a stale one. The new average comes from money in,
 * (old invested + amount) / new quantity, so invested stays exactly equal to
 * the rupees actually spent.
 */
export async function topUpHolding(
  _prev: HoldingActionState,
  formData: FormData,
): Promise<HoldingActionState> {
  const user = await requireUser();
  const parsed = topUpSchema.safeParse({
    holdingId: formData.get("holdingId"),
    mode: formData.get("mode"),
    amountInr: formData.get("amountInr") || undefined,
    quantity: formData.get("quantity") || undefined,
    pricePerUnit: formData.get("pricePerUnit") || undefined,
    date: formData.get("date") || undefined,
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

  // Ownership check: never trust an id from the client.
  const holding = await prisma.holding.findFirst({
    where: { id: d.holdingId, userId: user.id },
    include: { instrument: true },
  });
  if (!holding) return { status: "error", message: "Holding not found." };

  if (d.bankAccountId) {
    const owned = await prisma.bankAccount.findFirst({
      where: { id: d.bankAccountId, userId: user.id },
      select: { id: true },
    });
    if (!owned) {
      return { status: "error", message: "That bank account was not found." };
    }
  }

  let addedUnits: Prisma.Decimal;
  let spent: Prisma.Decimal; // in the instrument's own currency
  let pricedAt: string | null = null;

  if (d.mode === "QUANTITY") {
    addedUnits = new Prisma.Decimal(String(d.quantity));
    spent = addedUnits.times(new Prisma.Decimal(String(d.pricePerUnit)));
  } else {
    // Rupees invested: the units follow from the NAV on the purchase date.
    if (holding.instrument.type !== "MUTUAL_FUND") {
      return {
        status: "error",
        message: "Investing by amount is only available for mutual funds.",
      };
    }
    const schemeCode = holding.instrument.externalId;
    if (!schemeCode) {
      return {
        status: "error",
        message:
          "This fund has no AMFI scheme code, so its NAV cannot be looked up. Add units and price instead.",
      };
    }

    const on = parseUtcDate(d.date) ?? new Date();
    let nav: number;
    try {
      const history = await fetchNavHistory(schemeCode);
      const allotment = resolveAllotmentNav(history, on);
      if (!allotment) {
        // Naming the latest date that does exist makes this one click to fix.
        // The common case is buying today: a fund's NAV is published that
        // evening, so until then there is genuinely nothing to price against.
        const latest = history.dates[history.dates.length - 1];
        return {
          status: "error",
          message: latest
            ? `No NAV published for that date yet. The most recent is ${latest}, so pick that or earlier.`
            : "No NAV published for that date yet. Pick an earlier date, or enter units and price directly.",
        };
      }
      nav = allotment.nav;
      pricedAt = allotment.navDate;
    } catch {
      return {
        status: "error",
        message:
          "Could not reach the NAV source. Try again, or enter units and price directly.",
      };
    }

    spent = new Prisma.Decimal(String(d.amountInr));
    addedUnits = unitsForAmount(spent, new Prisma.Decimal(String(nav)));
  }

  await prisma.$transaction(async (tx) => {
    await tx.holding.update({
      where: { id: holding.id },
      data: {
        quantity: holding.quantity.plus(addedUnits),
        avgBuyPrice: blendedAverage(
          holding.quantity,
          holding.avgBuyPrice,
          addedUnits,
          spent,
        ),
      },
    });

    // Same reasoning as a SIP debit: the money moved from cash into units, so
    // net worth is unchanged and only its composition moves. Only ever in the
    // base currency, since a bank balance here is always INR.
    if (d.bankAccountId && holding.instrument.currency === "INR") {
      await tx.bankAccount.update({
        where: { id: d.bankAccountId },
        data: { balanceInr: { decrement: spent } },
      });
    }
  });

  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  revalidatePath("/funds");
  revalidatePath("/accounts");

  return {
    status: "success",
    message: pricedAt
      ? `Added ${addedUnits.toFixed(4)} units at the NAV for ${pricedAt}.`
      : `Added ${addedUnits.toFixed(4)} units.`,
  };
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
