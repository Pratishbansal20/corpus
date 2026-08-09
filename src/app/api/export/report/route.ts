import { requireUnlocked } from "@/lib/auth/require-user";
import { buildExportReportData } from "@/lib/pdf/report-data";
import { buildReportPdf } from "@/lib/pdf/build-report-pdf";

// Uses Prisma (pg adapter) and jsPDF, neither edge-safe: must run on Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Downloads a PDF of the signed-in user's investments and full financial
 * analysis. Gated the same way every other dashboard page is: signed in,
 * allowlisted, and passphrase-unlocked if a passphrase is set.
 *
 * The data this builds from (`buildExportReportData`) is the same
 * already-masked shape the dashboard renders (bank accounts and cards carry
 * only `last4`), so there is no full account number in memory to leak into
 * the file, and nothing here re-fetches or decrypts one.
 */
export async function GET() {
  const user = await requireUnlocked();

  const data = await buildExportReportData(user.id!, {
    name: user.name ?? null,
    email: user.email ?? null,
  });
  const pdfBytes = buildReportPdf(data);

  const stamp = data.generatedAt.toISOString().slice(0, 10);
  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="corpus-report-${stamp}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
