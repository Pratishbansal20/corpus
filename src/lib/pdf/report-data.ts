import { getUserPortfolio } from "@/lib/holdings/queries";
import {
  getBankAccounts,
  getManualAssets,
  sumBalances,
  sumAssetValues,
  BANK_ACCOUNT_TYPE_LABELS,
  ASSET_CATEGORY_LABELS,
} from "@/lib/accounts/queries";
import {
  getCreditCards,
  sumOutstanding,
  CARD_NETWORK_LABELS,
} from "@/lib/cards/queries";
import { computeNetWorth, type NetWorth } from "@/lib/networth/compute";
import {
  allocationByAssetClass,
  allocationByCountry,
  type AllocationSlice,
} from "@/lib/portfolio/allocation";
import { consolidateBySource, type AppConsolidation } from "@/lib/holdings/consolidation";
import type { Portfolio } from "@/lib/portfolio/valuation";

/**
 * Everything the PDF export needs, gathered in one place so the PDF builder
 * stays a pure function of data (easy to test, no Prisma in the render path).
 *
 * Every field here is already what the dashboard itself renders: bank
 * accounts and cards only ever carry `last4` (see `BankAccountView` /
 * `CreditCardView`), never the encrypted full account number or IFSC. There
 * is nothing to redact at render time because the query layer never fetched
 * it, which is the same guarantee the on-screen `•• 1234` masking relies on.
 */
export type ExportReportData = {
  generatedAt: Date;
  user: { name: string | null; email: string | null };
  netWorth: NetWorth;
  portfolio: Portfolio;
  assetClassAllocation: AllocationSlice[];
  countryAllocation: AllocationSlice[];
  appConsolidation: AppConsolidation;
  bankAccounts: {
    bankName: string;
    typeLabel: string;
    last4: string | null;
    balanceInr: number;
    asOf: Date;
  }[];
  manualAssets: {
    name: string;
    categoryLabel: string;
    valueInr: number;
    asOf: Date;
  }[];
  creditCards: {
    issuer: string;
    networkLabel: string;
    last4: string | null;
    outstandingInr: number;
    limitInr: number;
    utilizationPct: number;
  }[];
};

export async function buildExportReportData(
  userId: string,
  user: { name: string | null; email: string | null },
): Promise<ExportReportData> {
  const [portfolio, banks, assets, cards] = await Promise.all([
    getUserPortfolio(userId),
    getBankAccounts(userId),
    getManualAssets(userId),
    getCreditCards(userId),
  ]);

  const netWorth = computeNetWorth({
    investmentsInr: portfolio.summary.totalValueInr,
    bankInr: sumBalances(banks),
    otherAssetsInr: sumAssetValues(assets),
    cardOutstandingInr: sumOutstanding(cards),
  });

  return {
    generatedAt: new Date(),
    user,
    netWorth,
    portfolio,
    assetClassAllocation: allocationByAssetClass(portfolio.holdings),
    countryAllocation: allocationByCountry(portfolio.holdings),
    appConsolidation: consolidateBySource(portfolio.holdings),
    bankAccounts: banks.map((b) => ({
      bankName: b.bankName,
      typeLabel: BANK_ACCOUNT_TYPE_LABELS[b.accountType],
      last4: b.last4,
      balanceInr: b.balanceInr,
      asOf: b.asOf,
    })),
    manualAssets: assets.map((a) => ({
      name: a.name,
      categoryLabel: ASSET_CATEGORY_LABELS[a.category],
      valueInr: a.valueInr,
      asOf: a.asOf,
    })),
    creditCards: cards.map((c) => ({
      issuer: c.issuer,
      networkLabel: CARD_NETWORK_LABELS[c.network],
      last4: c.last4,
      outstandingInr: c.currentOutstanding,
      limitInr: c.creditLimit,
      utilizationPct: c.utilizationPct,
    })),
  };
}
