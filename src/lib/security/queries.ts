import { prisma } from "@/lib/db/prisma";

/**
 * Returns true if the user has set up their app passphrase.
 * Used to determine whether the Settings page shows "Set" vs "Change" UI
 * and whether requireUnlocked() should enforce the passphrase gate.
 */
export async function hasPassphrase(userId: string): Promise<boolean> {
  const row = await prisma.userSecurity.findUnique({
    where: { userId },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Returns true if TOTP passphrase recovery is set up. Used to determine
 * whether Settings shows "Set up recovery" vs "Turn off recovery", and
 * whether /unlock offers the "forgot your passphrase?" path at all.
 */
export async function hasTotpRecovery(userId: string): Promise<boolean> {
  const row = await prisma.userSecurity.findUnique({
    where: { userId },
    select: { totpEnabledAt: true },
  });
  return row?.totpEnabledAt != null;
}
