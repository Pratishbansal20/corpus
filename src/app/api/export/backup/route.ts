import { requireUnlocked } from "@/lib/auth/require-user";
import { buildBackupData } from "@/lib/backup/gather";
import { encryptBackup } from "@/lib/backup/crypto";
import { z } from "zod";

// Uses Prisma (pg adapter) and Node's crypto (scrypt): not edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  passphrase: z.string().min(6, "Passphrase must be at least 6 characters"),
});

/**
 * Downloads an encrypted backup of the signed-in user's data. POST, not
 * GET: the passphrase that encrypts it has to travel in the body, never a
 * URL (URLs end up in server logs, browser history, and Referer headers).
 *
 * Gated the same way every other export/dashboard route is: signed in,
 * allowlisted, passphrase-unlocked. The passphrase in the request body
 * encrypts the *file* and is unrelated to the app passphrase that just
 * unlocked this request — see lib/backup/crypto.ts for why they're kept
 * deliberately separate.
 */
export async function POST(req: Request) {
  const user = await requireUnlocked();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const data = await buildBackupData(user.id!, {
    name: user.name ?? null,
    email: user.email ?? null,
  });
  const envelope = await encryptBackup(data, parsed.data.passphrase);

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(envelope), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="corpus-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
