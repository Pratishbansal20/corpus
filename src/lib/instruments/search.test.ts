import { describe, it, expect } from "vitest";
import { parseMfapiSearch, parseYahooSearch, dedupe } from "./search";

describe("parseMfapiSearch", () => {
  const sample = [
    { schemeCode: 122639, schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth" },
    { schemeCode: 122640, schemeName: "Parag Parikh Flexi Cap Fund - Regular Plan - Growth" },
    { schemeCode: 153964, schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - IDCW" },
  ];

  it("carries the scheme code, which is what makes NAV pricing exact", () => {
    const [first] = parseMfapiSearch(sample);
    expect(first.type).toBe("MUTUAL_FUND");
    expect(first.externalId).toBe("122639");
  });

  it("uses the scheme code as the symbol, since funds have no ticker", () => {
    // Deriving a symbol from the name would collide across plan variants: all
    // three of these differ only by plan and option.
    const symbols = parseMfapiSearch(sample).map((h) => h.symbol);
    expect(symbols).toEqual(["MF122639", "MF122640", "MF153964"]);
    expect(new Set(symbols).size).toBe(3);
  });

  it("labels the plan and option so lookalikes are pickable apart", () => {
    expect(parseMfapiSearch(sample).map((h) => h.hint)).toEqual([
      "Direct Growth",
      "Regular Growth",
      "Direct IDCW",
    ]);
  });

  it("ignores rows it cannot use, and non-arrays", () => {
    expect(
      parseMfapiSearch([
        { schemeCode: 1, schemeName: "" },
        { schemeName: "No code here" },
        { schemeCode: 2, schemeName: "Fine Fund" },
      ]),
    ).toHaveLength(1);
    expect(parseMfapiSearch(null)).toEqual([]);
    expect(parseMfapiSearch({ error: "boom" })).toEqual([]);
  });

  it("honours the limit", () => {
    expect(parseMfapiSearch(sample, 2)).toHaveLength(2);
  });
});

describe("parseYahooSearch", () => {
  const sample = {
    quotes: [
      { symbol: "INFY", exchange: "NYQ", quoteType: "EQUITY", shortname: "Infosys Limited" },
      { symbol: "I1FO34.SA", exchange: "SAO", quoteType: "EQUITY", shortname: "INFOSYS LTD DRN" },
      { symbol: "INFY.NS", exchange: "NSI", quoteType: "EQUITY", shortname: "INFOSYS LIMITED" },
      { symbol: "INFY.BA", exchange: "BUE", quoteType: "EQUITY", shortname: "CEDEAR" },
      { symbol: "HCL-INSYS.BO", exchange: "BSE", quoteType: "EQUITY", shortname: "HCL INFOSYSTEMS" },
      { symbol: "IOY.HM", exchange: "HAM", quoteType: "EQUITY", shortname: "Infosys Ltd." },
    ],
  };

  it("maps an NSE listing to an Indian stock and strips the suffix", () => {
    // The price provider quotes Indian stocks by appending .NS, so the stored
    // symbol must be the bare ticker or it would never price.
    const hit = parseYahooSearch(sample).find((h) => h.type === "IN_STOCK");
    expect(hit).toMatchObject({ symbol: "INFY", hint: "NSE" });
  });

  it("keeps a US listing as a bare symbol", () => {
    const hit = parseYahooSearch(sample).find((h) => h.type === "US_STOCK");
    expect(hit).toMatchObject({ symbol: "INFY", hint: "NYSE" });
  });

  it("drops listings the pricing pipeline could never quote", () => {
    // Sao Paulo, Buenos Aires, Hamburg and BSE-only all resolve to nothing the
    // app can price, so offering them would be a trap.
    const symbols = parseYahooSearch(sample).map((h) => h.symbol);
    expect(symbols).not.toContain("I1FO34.SA");
    expect(symbols).not.toContain("INFY.BA");
    expect(symbols).not.toContain("HCL-INSYS.BO");
    expect(symbols).not.toContain("IOY.HM");
  });

  it("softens shouted names but leaves normal ones alone", () => {
    const [us, inr] = parseYahooSearch(sample);
    expect(us.name).toBe("Infosys Limited");
    expect(inr.name).toBe("Infosys Limited");
  });

  it("skips anything that is not a tradable equity or ETF", () => {
    expect(
      parseYahooSearch({
        quotes: [
          { symbol: "^NSEI", exchange: "NSI", quoteType: "INDEX", shortname: "NIFTY 50" },
          { symbol: "USDINR=X", exchange: "CCY", quoteType: "CURRENCY" },
        ],
      }),
    ).toEqual([]);
  });

  it("survives a malformed payload", () => {
    expect(parseYahooSearch(null)).toEqual([]);
    expect(parseYahooSearch({})).toEqual([]);
    expect(parseYahooSearch({ quotes: "nope" })).toEqual([]);
  });
});

describe("dedupe", () => {
  it("keeps one row per type and symbol, the Instrument table's own key", () => {
    const out = dedupe([
      { type: "IN_STOCK", symbol: "INFY", name: "Infosys" },
      { type: "US_STOCK", symbol: "INFY", name: "Infosys ADR" },
      { type: "IN_STOCK", symbol: "INFY", name: "Infosys again" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Infosys");
  });
});
