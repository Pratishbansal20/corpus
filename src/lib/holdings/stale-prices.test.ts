import { describe, it, expect } from "vitest";
import {
  findStalePrices,
  stalePriceMessage,
  STALE_PRICE_DAYS,
  type PricedInstrument,
} from "./stale-prices";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const NOW = day("2026-08-07");

const inst = (
  symbol: string,
  type: PricedInstrument["type"],
  lastPriced: string | null,
): PricedInstrument => ({
  instrumentId: `id-${symbol}`,
  symbol,
  name: symbol,
  type,
  lastPricedAt: lastPriced ? day(lastPriced) : null,
});

describe("findStalePrices", () => {
  it("says nothing when everything priced together", () => {
    expect(
      findStalePrices(
        [
          inst("ITC", "IN_STOCK", "2026-08-07"),
          inst("WIPRO", "IN_STOCK", "2026-08-07"),
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("stays quiet over a long weekend, when everything is equally old", () => {
    // The whole point of comparing against peers: a closed market must not
    // produce an alert, however many days it has been shut.
    const stale = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-03"),
        inst("WIPRO", "IN_STOCK", "2026-08-03"),
      ],
      day("2026-08-07"),
    );
    expect(stale).toEqual([]);
  });

  it("flags the one symbol its peers left behind", () => {
    // The real bug: VENTURA 404'd on every refresh while everything around it
    // priced normally, so the calendar cannot be the explanation.
    const stale = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("WIPRO", "IN_STOCK", "2026-08-07"),
        inst("VENTURA", "IN_STOCK", "2026-06-29"),
      ],
      NOW,
    );
    expect(stale).toHaveLength(1);
    expect(stale[0]).toMatchObject({ symbol: "VENTURA", reason: "LAGGING" });
    expect(stale[0].daysBehind).toBe(39);
  });

  it("does not flag a lag inside the allowed slack", () => {
    const atLimit = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("LAGGY", "IN_STOCK", "2026-08-02"), // exactly 5 behind
      ],
      NOW,
    );
    expect(atLimit).toEqual([]);

    const pastLimit = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("LAGGY", "IN_STOCK", "2026-08-01"), // 6 behind
      ],
      NOW,
    );
    expect(pastLimit.map((s) => s.symbol)).toEqual(["LAGGY"]);
  });

  it("judges each asset type against its own kind", () => {
    // A fund's NAV lands the evening of the day it applies to, so it routinely
    // trails an equity quote. Comparing across types would flag it daily.
    const stale = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("HDFC_FLEXI", "MUTUAL_FUND", "2026-08-06"),
        inst("QQQM", "US_STOCK", "2026-08-07"),
      ],
      NOW,
    );
    expect(stale).toEqual([]);
  });

  it("reports a whole dead source rather than blaming each symbol", () => {
    // The AMFI outage: every fund stopped at once, so no fund looks unusual
    // beside its peers. Only the clock reveals it.
    const stale = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("HDFC_FLEXI", "MUTUAL_FUND", "2026-06-01"),
        inst("NIPPON_SMALL", "MUTUAL_FUND", "2026-06-01"),
      ],
      NOW,
    );
    expect(stale).toHaveLength(2);
    expect(stale.every((s) => s.reason === "SOURCE_DOWN")).toBe(true);
    expect(stale.every((s) => s.type === "MUTUAL_FUND")).toBe(true);
  });

  it("flags an instrument that has never priced at all", () => {
    const stale = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("BROKEN", "IN_STOCK", null),
      ],
      NOW,
    );
    expect(stale.map((s) => [s.symbol, s.reason])).toEqual([
      ["BROKEN", "NEVER_PRICED"],
    ]);
  });

  it("flags every member when a type has never priced", () => {
    const stale = findStalePrices([inst("A", "US_STOCK", null)], NOW);
    expect(stale[0].reason).toBe("NEVER_PRICED");
  });

  it("handles an empty portfolio", () => {
    expect(findStalePrices([], NOW)).toEqual([]);
  });

  it("puts the worst offender first", () => {
    const stale = findStalePrices(
      [
        inst("OK", "IN_STOCK", "2026-08-07"),
        inst("MILD", "IN_STOCK", "2026-07-20"),
        inst("WORST", "IN_STOCK", "2026-06-01"),
      ],
      NOW,
    );
    expect(stale.map((s) => s.symbol)).toEqual(["WORST", "MILD"]);
  });
});

describe("stalePriceMessage", () => {
  it("returns nothing when all is well", () => {
    expect(stalePriceMessage([])).toBeNull();
  });

  it("names the symbols so the fix is obvious", () => {
    const stale = findStalePrices(
      [
        inst("ITC", "IN_STOCK", "2026-08-07"),
        inst("VENTURA", "IN_STOCK", "2026-06-29"),
      ],
      NOW,
    );
    const msg = stalePriceMessage(stale)!;
    expect(msg).toContain("VENTURA");
    expect(msg).toMatch(/symbol is probably wrong/);
  });

  it("leads with a down source over individual symbols", () => {
    const stale = findStalePrices(
      [
        inst("A", "MUTUAL_FUND", "2026-06-01"),
        inst("B", "MUTUAL_FUND", "2026-06-01"),
      ],
      NOW,
    );
    expect(stalePriceMessage(stale)).toMatch(/price source may be down/);
  });

  it("summarises rather than listing everything", () => {
    const many = [
      inst("OK", "IN_STOCK", "2026-08-07"),
      ...["A", "B", "C", "D", "E"].map((s) =>
        inst(s, "IN_STOCK", "2026-06-01"),
      ),
    ];
    const msg = stalePriceMessage(findStalePrices(many, NOW))!;
    expect(msg).toMatch(/and 2 more/);
  });

  it("uses a slack that clears the longest realistic market closure", () => {
    expect(STALE_PRICE_DAYS).toBe(5);
  });
});
