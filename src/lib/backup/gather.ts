import { buildExportReportData, type ExportReportData } from "@/lib/pdf/report-data";
import { getSipPlans } from "@/lib/sips/queries";
import { getCreditScores } from "@/lib/credit/queries";
import type { SipView } from "@/lib/sips/constants";
import type { CreditScoreView } from "@/lib/credit/queries";

export type BackupData = ExportReportData & {
  sips: SipView[];
  creditScores: CreditScoreView[];
};

/**
 * Everything the backup export encrypts. Deliberately reuses
 * buildExportReportData() wholesale rather than re-querying the same
 * tables a second way: that function's whole contract is "only what the
 * dashboard already renders, bank accounts and cards masked to last4,"
 * and a backup should carry exactly that same privacy shape, not a wider
 * one. SIPs and credit scores are the two things the PDF report doesn't
 * already gather that a "restore my data" snapshot should still have.
 *
 * What this does *not* include, on purpose: full bank account numbers and
 * IFSC codes. Those are AES-256-GCM encrypted at rest with ENCRYPTION_KEY
 * and decrypting them into a second, separately-encrypted file would be a
 * bigger change than "add a backup button" deserves to be — same call
 * PDF export already made, for the same reason (see report-data.ts).
 */
export async function buildBackupData(
  userId: string,
  user: { name: string | null; email: string | null },
): Promise<BackupData> {
  const [report, sips, creditScores] = await Promise.all([
    buildExportReportData(userId, user),
    getSipPlans(userId),
    getCreditScores(userId),
  ]);

  return { ...report, sips, creditScores };
}
