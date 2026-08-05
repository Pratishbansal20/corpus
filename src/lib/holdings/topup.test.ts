import { describe, it, expect } from "vitest";
import { topUpSchema, parseUtcDate } from "./topup";

const base = { holdingId: "h1" };

describe("topUpSchema", () => {
  it("accepts a rupee amount in AMOUNT mode", () => {
    const r = topUpSchema.safeParse({ ...base, mode: "AMOUNT", amountInr: "25000" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amountInr).toBe(25000);
  });

  it("requires the amount in AMOUNT mode", () => {
    const r = topUpSchema.safeParse({ ...base, mode: "AMOUNT" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.amountInr?.[0]).toMatch(/amount/i);
    }
  });

  it("requires both units and price in QUANTITY mode", () => {
    const r = topUpSchema.safeParse({ ...base, mode: "QUANTITY", quantity: "10" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.pricePerUnit?.[0]).toMatch(/price/i);
    }
  });

  it("rejects zero and negative purchases", () => {
    expect(
      topUpSchema.safeParse({ ...base, mode: "AMOUNT", amountInr: "0" }).success,
    ).toBe(false);
    expect(
      topUpSchema.safeParse({
        ...base,
        mode: "QUANTITY",
        quantity: "-5",
        pricePerUnit: "100",
      }).success,
    ).toBe(false);
  });

  it("treats an unselected bank as no bank rather than an error", () => {
    // An unselected <select> posts "", which must mean "do not touch a balance".
    const r = topUpSchema.safeParse({
      ...base,
      mode: "AMOUNT",
      amountInr: "1000",
      bankAccountId: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.bankAccountId).toBeUndefined();
  });
});

describe("parseUtcDate", () => {
  it("builds the date at UTC midnight", () => {
    // Local midnight would store 18:30 the previous day under IST and pick the
    // NAV for the wrong day.
    const d = parseUtcDate("2026-08-03")!;
    expect(d.toISOString()).toBe("2026-08-03T00:00:00.000Z");
    expect(d.getUTCHours()).toBe(0);
  });

  it("returns null for anything it cannot trust", () => {
    expect(parseUtcDate(undefined)).toBeNull();
    expect(parseUtcDate("")).toBeNull();
    expect(parseUtcDate("03-08-2026")).toBeNull();
    expect(parseUtcDate("garbage")).toBeNull();
  });
});
