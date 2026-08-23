import { describe, expect, it } from "vitest";
import { parseAmfiNavFile } from "./amfi-nav";

describe("parseAmfiNavFile", () => {
  // Real column layout as of 2026-08: Name, Plan and Option are three
  // separate columns, not one combined "Scheme Name" string. This fixture
  // is what actually broke every mutual fund at once when AMFI shipped the
  // change (see the doc comment on parseAmfiNavFile): the old 6-column
  // indices silently misread "Direct Plan" as the NAV number.
  const sample = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
120503;INF846K01EW2;INF846K01EX8;Parag Parikh Flexi Cap Fund;Direct Plan;Growth;85.1234;28-Jun-2026`;

  it("parses the current 8-column layout (Name/Plan/Option split)", () => {
    const map = parseAmfiNavFile(sample);
    expect(map.size).toBe(1);
    const row = map.get("120503");
    expect(row?.nav).toBeCloseTo(85.1234);
    expect(row?.asOf.getUTCFullYear()).toBe(2026);
  });

  it("rejoins Name, Plan and Option so name-fallback matching still works", () => {
    const map = parseAmfiNavFile(sample);
    const row = map.get("120503");
    expect(row?.name).toBe("Parag Parikh Flexi Cap Fund Direct Plan Growth");
  });

  it("rejects the old 6-column layout rather than silently misreading it", () => {
    // A regression guard in the other direction: if AMFI's layout ever
    // shrinks back, this must not resurrect the original bug (reading a
    // non-numeric column as the NAV) — it should just parse to nothing.
    const oldFormat = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
120503;INF846K01EW2;INF846K01EX8;Parag Parikh Flexi Cap Fund Direct Growth;85.1234;28-Jun-2026`;
    expect(parseAmfiNavFile(oldFormat).size).toBe(0);
  });

  it("skips section headers and blank lines", () => {
    const withSections = ` \nOpen Ended Schemes(Debt Scheme)\n \nSome Fund House\n \n${sample}`;
    const map = parseAmfiNavFile(withSections);
    expect(map.size).toBe(1);
  });
});
