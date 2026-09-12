import { describe, expect, it } from "vitest";
import { classifyAsBuy, parseCasStatement } from "./cas-cams-kfintech";

// A fabricated excerpt in the CAS's real shape (fund/folio/ISIN values are
// invented, not copied from any real statement - see data/README.md).
const SAMPLE = `
CAMSCASWS-0000000000 Version:V3.5 Live-1018
Consolidated Account Statement
01-Jan-2004 To 11-Sep-2026
Page 1 of 1
Email Id: someone@example.com
 EXAMPLE INVESTOR
123 EXAMPLE STREET
EXAMPLE CITY
Mutual Fund Cost Value
(INR)
Market Value
(INR)
PORTFOLIO SUMMARY
 Example Mutual Fund 10,000.00 10,500.00
Total 10,000.00 10,500.00
Date Transaction Amount Units Price Unit
(INR) (INR) Balance
Example Mutual Fund
PAN: ABCDE1234F KYC: OK PAN: OK
GD001-Example Flexi Cap Fund-Direct Plan-Growth (Non-Demat) - ISIN: INF000A00000(Advisor: INZ000000001) Registrar : CAMS
Folio No: 1234567 / 89
Example Investor
 Nominee 1: Nominee 2: Nominee 3:
 Opening Unit Balance: 0.000
19-May-2025 Net Systematic Purchase-BSE - Instalment No - 1 via Online 249.99 5.152 48.523 5.152
19-May-2025 *** Stamp Duty *** 0.01
20-May-2025 ***Address Updated from KRA Data***
05-Jun-2025 Net Systematic Purchase-BSE - Instalment No - 1 via Online 249.99 4.982 50.180 10.134
05-Jun-2025 *** Stamp Duty *** 0.01
15-Jul-2025 ***Cancelled***
NAV on 10-Sep-2026: INR 57.799 Market Value on 10-Sep-2026: INR 585.65
Some legal footnote text that should never be mistaken for a transaction.
Closing Unit Balance: 10.134 Total Cost Value: 500.00
`;

describe("parseCasStatement", () => {
  it("extracts every real purchase line, in order", () => {
    const { transactions } = parseCasStatement(SAMPLE);
    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({
      isin: "INF000A00000",
      folio: "1234567 / 89",
      date: "2025-05-19",
      amount: 249.99,
      units: 5.152,
      price: 48.523,
    });
    expect(transactions[1].date).toBe("2025-06-05");
  });

  it("drops Stamp Duty, Cancelled and Address Updated noise lines", () => {
    const { transactions } = parseCasStatement(SAMPLE);
    const descriptions = transactions.map((t) => t.description);
    expect(descriptions.some((d) => /stamp duty/i.test(d))).toBe(false);
    expect(descriptions.some((d) => /cancelled/i.test(d))).toBe(false);
  });

  it("captures the folio's closing balance and total cost value", () => {
    const { folios } = parseCasStatement(SAMPLE);
    expect(folios).toEqual([
      expect.objectContaining({
        isin: "INF000A00000",
        folio: "1234567 / 89",
        closingUnits: 10.134,
        totalCostValue: 500,
      }),
    ]);
  });

  it("builds a stable lineRef for import idempotency", () => {
    const { transactions } = parseCasStatement(SAMPLE);
    const [first] = transactions;
    expect(first.lineRef).toBe(
      "1234567 / 89:2025-05-19:Net Systematic Purchase-BSE - Instalment No - 1 via Online:249.99:5.152",
    );
  });

  it("gives two same-day, same-amount instalments distinct lineRefs (confirmed real shape: a registrar can post two genuinely separate purchases with identical date/description/amount)", () => {
    const twoInstalmentsSameDay = SAMPLE.replace(
      "05-Jun-2025 Net Systematic Purchase-BSE - Instalment No - 1 via Online 249.99 4.982 50.180 10.134",
      "19-May-2025 Net Systematic Purchase-BSE - Instalment No - 1 via Online 249.99 4.982 50.180 10.134",
    );
    const { transactions } = parseCasStatement(twoInstalmentsSameDay);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].lineRef).not.toBe(transactions[1].lineRef);
  });

  it("reports nothing as unparsed for a clean statement", () => {
    const { unparsed } = parseCasStatement(SAMPLE);
    expect(unparsed).toEqual([]);
  });

  it("surfaces a transaction-shaped line it could not fully parse, rather than dropping it silently", () => {
    const withGarbledLine = SAMPLE.replace(
      "05-Jun-2025 Net Systematic Purchase-BSE - Instalment No - 1 via Online 249.99 4.982 50.180 10.134",
      "05-Jun-2025 Some new registrar wording nobody has seen before, no trailing numbers",
    );
    const { unparsed } = parseCasStatement(withGarbledLine);
    expect(unparsed).toHaveLength(1);
    expect(unparsed[0]).toContain("Some new registrar wording");
  });
});

describe("classifyAsBuy", () => {
  it("treats an ordinary purchase description as a BUY", () => {
    const { transactions } = parseCasStatement(SAMPLE);
    expect(transactions.every(classifyAsBuy)).toBe(true);
  });

  it("does not classify a redemption or dividend description as a BUY", () => {
    const base = parseCasStatement(SAMPLE).transactions[0];
    expect(classifyAsBuy({ ...base, description: "Redemption via Online" })).toBe(false);
    expect(classifyAsBuy({ ...base, description: "IDCW Payout" })).toBe(false);
    expect(classifyAsBuy({ ...base, description: "Switch-out to Growth Plan" })).toBe(false);
  });
});
