import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma";
import { unitsForAmount, blendedAverage } from "./math";

const d = (v: string | number) => new Prisma.Decimal(String(v));

describe("unitsForAmount", () => {
  it("divides the debit by the allotment NAV", () => {
    // ₹3,000 into JioBlackRock Flexi Cap at a NAV of 10.0502.
    expect(unitsForAmount(d(3000), d("10.05020")).toString()).toBe("298.501522");
  });

  it("rounds to the quantity column's scale", () => {
    expect(unitsForAmount(d(1000), d(3)).toString()).toBe("333.333333");
  });
});

describe("blendedAverage", () => {
  it("moves the average toward the price just paid", () => {
    // 100 units at ₹10 (₹1,000 invested), then ₹1,000 more at ₹20 = 50 units.
    // 150 units for ₹2,000 = ₹13.333333.
    const avg = blendedAverage(d(100), d(10), d(50), d(1000));
    expect(avg.toString()).toBe("13.333333");
  });

  it("leaves the average alone when the price has not changed", () => {
    const avg = blendedAverage(d(100), d(10), d(100), d(1000));
    expect(avg.toString()).toBe("10");
  });

  it("keeps invested equal to the rupees actually debited", () => {
    // The figure a bank statement can be checked against. Pricing off the
    // rounded unit count instead would leak paise on every debit.
    let qty = d("1524.646276");
    let avg = d("9.837692");
    const invested0 = qty.times(avg);

    for (const [amount, nav] of [
      [3000, "10.05020"],
      [3000, "10.13400"],
      [3000, "9.98390"],
    ] as const) {
      const units = unitsForAmount(d(amount), d(nav));
      avg = blendedAverage(qty, avg, units, d(amount));
      qty = qty.plus(units);
    }

    const invested = qty.times(avg);
    const expected = invested0.plus(9000);
    // Within a rupee across three debits: only the column's rounding, no drift.
    expect(invested.minus(expected).abs().toNumber()).toBeLessThan(1);
  });

  it("uses the NAV as the average for a first purchase", () => {
    const avg = blendedAverage(d(0), d(0), d("298.501522"), d(3000));
    expect(avg.toNumber()).toBeCloseTo(10.0502, 4);
  });

  it("does not divide by zero when there is nothing held", () => {
    expect(blendedAverage(d(0), d("42.5"), d(0), d(0)).toString()).toBe("42.5");
  });
});
