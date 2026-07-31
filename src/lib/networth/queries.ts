import { getUserPortfolio } from "@/lib/holdings/queries";
import {
  getBankAccounts,
  getManualAssets,
  sumBalances,
  sumAssetValues,
} from "@/lib/accounts/queries";
import { getCreditCards, sumOutstanding } from "@/lib/cards/queries";
import { computeNetWorth, type NetWorth } from "./compute";

/**
 * Current net worth totals. Used by the persistent sidebar readout so the one
 * number you open the app for is on screen on every page.
 */
export async function getNetWorthTotals(userId: string): Promise<NetWorth> {
  const [portfolio, banks, assets, cards] = await Promise.all([
    getUserPortfolio(userId),
    getBankAccounts(userId),
    getManualAssets(userId),
    getCreditCards(userId),
  ]);

  return computeNetWorth({
    investmentsInr: portfolio.summary.totalValueInr,
    bankInr: sumBalances(banks),
    otherAssetsInr: sumAssetValues(assets),
    cardOutstandingInr: sumOutstanding(cards),
  });
}
