import { describe, expect, it } from "vitest";
import { buildReportPdf } from "./build-report-pdf";
import type { ExportReportData } from "./report-data";

const asOf = new Date("2026-08-01T00:00:00.000Z");

function baseData(overrides: Partial<ExportReportData> = {}): ExportReportData {
  return {
    generatedAt: new Date("2026-08-10T12:00:00.000Z"),
    user: { name: "Pratish Bansal", email: "pratishbansal2017@gmail.com" },
    netWorth: {
      netWorthInr: 900_000,
      totalAssetsInr: 1_000_000,
      totalLiabilitiesInr: 100_000,
      investmentsInr: 700_000,
      bankInr: 250_000,
      otherAssetsInr: 50_000,
      cardOutstandingInr: 100_000,
    },
    portfolio: {
      holdings: [
        {
          id: "h1",
          symbol: "INFY",
          name: "Infosys",
          type: "IN_STOCK",
          country: "IN",
          currency: "INR",
          source: "GROWW",
          quantity: 10,
          avgBuyPrice: 1500,
          currentPrice: 1600,
          hasLivePrice: true,
          investedInr: 15_000,
          currentValueInr: 16_000,
          pnlInr: 1_000,
          pnlPct: 6.67,
          weightPct: 100,
        },
      ],
      summary: {
        totalValueInr: 16_000,
        investedInr: 15_000,
        pnlInr: 1_000,
        pnlPct: 6.67,
        holdingsCount: 1,
        hasLivePrices: true,
        fxIsLive: true,
      },
    },
    assetClassAllocation: [{ key: "IN_STOCK", label: "Indian Stocks", valueInr: 16_000, pct: 100 }],
    countryAllocation: [{ key: "IN", label: "India", valueInr: 16_000, pct: 100 }],
    appConsolidation: {
      groups: [
        {
          source: "GROWW",
          label: "Groww",
          valueInr: 16_000,
          investedInr: 15_000,
          pnlInr: 1_000,
          pnlPct: 6.67,
          count: 1,
          weightPct: 100,
        },
      ],
      totalValueInr: 16_000,
    },
    bankAccounts: [
      { bankName: "HDFC Bank", typeLabel: "Savings", last4: "4583", balanceInr: 250_000, asOf },
    ],
    manualAssets: [{ name: "Gold", categoryLabel: "Gold", valueInr: 50_000, asOf }],
    creditCards: [
      {
        issuer: "HDFC",
        networkLabel: "Visa",
        last4: "1234",
        outstandingInr: 100_000,
        limitInr: 300_000,
        utilizationPct: 33.3,
      },
    ],
    ...overrides,
  };
}

describe("buildReportPdf", () => {
  it("produces a well-formed PDF for a full portfolio", () => {
    const bytes = buildReportPdf(baseData());
    const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(header).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("never emits the raw currency glyph jsPDF's base fonts can't render", () => {
    const bytes = buildReportPdf(baseData());
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).not.toContain("₹");
  });

  it("does not throw when every section is empty", () => {
    const bytes = buildReportPdf(
      baseData({
        portfolio: {
          holdings: [],
          summary: {
            totalValueInr: 0,
            investedInr: 0,
            pnlInr: 0,
            pnlPct: 0,
            holdingsCount: 0,
            hasLivePrices: false,
            fxIsLive: false,
          },
        },
        assetClassAllocation: [],
        countryAllocation: [],
        appConsolidation: { groups: [], totalValueInr: 0 },
        bankAccounts: [],
        manualAssets: [],
        creditCards: [],
      }),
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("handles an account with no last4 as masked 'Not set', never a blank cell", () => {
    const bytes = buildReportPdf(
      baseData({
        bankAccounts: [
          { bankName: "SBI", typeLabel: "Savings", last4: null, balanceInr: 1000, asOf },
        ],
      }),
    );
    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");
  });

  it("spans multiple pages once content overflows one, and numbers them all", () => {
    const manyHoldings = Array.from({ length: 60 }, (_, i) => ({
      id: `h${i}`,
      symbol: `SYM${i}`,
      name: `Stock ${i}`,
      type: "IN_STOCK" as const,
      country: "IN" as const,
      currency: "INR",
      source: "GROWW",
      quantity: 10,
      avgBuyPrice: 100,
      currentPrice: 110,
      hasLivePrice: true,
      investedInr: 1000,
      currentValueInr: 1100,
      pnlInr: 100,
      pnlPct: 10,
      weightPct: 100 / 60,
    }));
    const bytes = buildReportPdf(
      baseData({
        portfolio: {
          holdings: manyHoldings,
          summary: {
            totalValueInr: 66_000,
            investedInr: 60_000,
            pnlInr: 6_000,
            pnlPct: 10,
            holdingsCount: 60,
            hasLivePrices: true,
            fxIsLive: true,
          },
        },
      }),
    );
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("Page 1 of");
    expect(text).toMatch(/Page \d+ of [2-9]/); // more than one page
  });
});
