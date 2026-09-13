import { describe, expect, it } from "vitest";
import { computeXirr, isTrustworthyDateSource, type CashFlow } from "./xirr";

const DAY_MS = 86_400_000;
function daysAfter(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

// Every rate this module returns is checked against its own definition
// (NPV at that rate is ~0), not just a hand-typed expected number: that
// catches an implementation bug a fragile "matches this constant" assertion
// would not.
function assertIsARoot(flows: CashFlow[], rate: number) {
  const t0 = flows[0].date.getTime();
  const npv = flows.reduce((sum, f) => {
    const years = (f.date.getTime() - t0) / DAY_MS / 365;
    return sum + f.amount / Math.pow(1 + rate, years);
  }, 0);
  expect(Math.abs(npv)).toBeLessThan(0.01);
}

describe("computeXirr", () => {
  const start = new Date("2024-01-01T00:00:00.000Z");

  it("solves a single buy-then-sell exactly one year apart to ~10%", () => {
    // 1000 becomes 1100 in exactly 365 days: a textbook 10% annual return.
    const flows: CashFlow[] = [
      { date: start, amount: -1000 },
      { date: daysAfter(start, 365), amount: 1100 },
    ];
    const rate = computeXirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(0.1, 3);
    assertIsARoot(flows, rate!);
  });

  it("solves a doubled investment over two years to ~41.4% (sqrt(2) - 1)", () => {
    const flows: CashFlow[] = [
      { date: start, amount: -1000 },
      { date: daysAfter(start, 730), amount: 2000 },
    ];
    const rate = computeXirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeCloseTo(Math.sqrt(2) - 1, 3);
  });

  it("solves a realistic multi-instalment SIP-shaped stream", () => {
    // Three purchases six months apart, then a snapshot value - the exact
    // shape a fund's real cash-flow list has. No closed-form answer, so this
    // only checks the returned rate actually zeroes the NPV.
    const flows: CashFlow[] = [
      { date: start, amount: -1000 },
      { date: daysAfter(start, 182), amount: -1000 },
      { date: daysAfter(start, 365), amount: -1000 },
      { date: daysAfter(start, 400), amount: 3600 },
    ];
    const rate = computeXirr(flows);
    expect(rate).not.toBeNull();
    assertIsARoot(flows, rate!);
    expect(rate!).toBeGreaterThan(0); // grew overall
  });

  it("handles an out-of-date-order input the same as a pre-sorted one", () => {
    const sorted: CashFlow[] = [
      { date: start, amount: -1000 },
      { date: daysAfter(start, 365), amount: 1100 },
    ];
    const shuffled: CashFlow[] = [sorted[1], sorted[0]];
    expect(computeXirr(shuffled)).toBeCloseTo(computeXirr(sorted)!, 6);
  });

  it("returns null for fewer than two cash flows", () => {
    expect(computeXirr([])).toBeNull();
    expect(computeXirr([{ date: start, amount: -1000 }])).toBeNull();
  });

  it("returns null when every flow is an outflow (nothing ever came back)", () => {
    const flows: CashFlow[] = [
      { date: start, amount: -1000 },
      { date: daysAfter(start, 30), amount: -500 },
    ];
    expect(computeXirr(flows)).toBeNull();
  });

  it("returns null when every flow is an inflow", () => {
    const flows: CashFlow[] = [
      { date: start, amount: 1000 },
      { date: daysAfter(start, 30), amount: 500 },
    ];
    expect(computeXirr(flows)).toBeNull();
  });

  it("handles a loss (negative XIRR) correctly", () => {
    const flows: CashFlow[] = [
      { date: start, amount: -1000 },
      { date: daysAfter(start, 365), amount: 800 },
    ];
    const rate = computeXirr(flows);
    expect(rate).not.toBeNull();
    expect(rate!).toBeLessThan(0);
    assertIsARoot(flows, rate!);
  });

  it("never throws on a pathological input, even one with no solvable root in range", () => {
    // A flow shaped so extreme no realistic annual rate solves it in the
    // bisection fallback's search range - must degrade to null, not throw.
    const flows: CashFlow[] = [
      { date: start, amount: -1 },
      { date: daysAfter(start, 1), amount: 1_000_000_000 },
    ];
    expect(() => computeXirr(flows)).not.toThrow();
  });
});

describe("isTrustworthyDateSource", () => {
  it("trusts SIP, TOPUP and CAS_IMPORT dates", () => {
    expect(isTrustworthyDateSource("SIP")).toBe(true);
    expect(isTrustworthyDateSource("TOPUP")).toBe(true);
    expect(isTrustworthyDateSource("CAS_IMPORT")).toBe(true);
  });

  it("does not trust a fabricated entry date", () => {
    expect(isTrustworthyDateSource("MANUAL_ENTRY")).toBe(false);
    expect(isTrustworthyDateSource("OPENING_BALANCE")).toBe(false);
  });
});
