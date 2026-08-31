"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import type { FormActionState } from "@/lib/forms/action-state";
import { hashPassphrase, verifyPassphrase } from "./passphrase";
import { generateTotpEnrollment, totpQrSvg, verifyTotpCode } from "./totp";
import { encrypt, decrypt } from "@/lib/crypto/encryption";
import { z } from "zod";

// ---------- helpers ----------

const SESSION_COOKIE_DEV = "authjs.session-token";
const SESSION_COOKIE_PROD = "__Secure-authjs.session-token";

/** Reads the current session token from the Auth.js cookie. */
async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return (
    jar.get(SESSION_COOKIE_PROD)?.value ??
    jar.get(SESSION_COOKIE_DEV)?.value
  );
}

// Every route the (dashboard) layout gates. Listed explicitly because the
// group's shared layout has no URL prefix of its own to revalidate in one
// call (it's a route *group*, `(dashboard)`, not a URL segment).
const DASHBOARD_ROUTES = [
  "/dashboard",
  "/holdings",
  "/funds",
  "/accounts",
  "/cards",
  "/settings",
];

/**
 * Marks the current session unlocked and sends the browser to /dashboard.
 *
 * The revalidatePath calls are load-bearing, not cleanup: next.config.ts
 * sets `staleTimes.dynamic: 30`, so a page visited *while still locked*
 * (redirected straight to /unlock by requireUnlocked()) stays cached
 * client-side as "redirects to /unlock" for up to 30 seconds. Without
 * busting that cache here, redirect("/dashboard") below can land back on
 * that exact stale cached response and bounce straight back to /unlock —
 * looking exactly like the passphrase was never accepted, even though the
 * database was updated correctly, since a typed URL (a hard navigation)
 * always bypasses this cache and a soft one does not. Every other
 * mutation in this app already calls revalidatePath() for the same reason;
 * this one just hadn't needed it until the client router cache existed.
 */
async function unlockCurrentSessionAndRedirect(): Promise<never> {
  const token = await getSessionToken();
  if (token) {
    await prisma.session.updateMany({
      where: { sessionToken: token },
      data: { unlockedAt: new Date() },
    });
  }

  for (const route of DASHBOARD_ROUTES) revalidatePath(route);

  redirect("/dashboard");
}

// ---------- schemas ----------

const setupSchema = z.object({
  passphrase: z
    .string()
    .min(6, "Passphrase must be at least 6 characters")
    .max(128),
  confirm: z.string(),
}).refine((d) => d.passphrase === d.confirm, {
  message: "Passphrases don't match",
  path: ["confirm"],
});

const changeSchema = z.object({
  current: z.string().min(1, "Enter your current passphrase"),
  passphrase: z
    .string()
    .min(6, "Passphrase must be at least 6 characters")
    .max(128),
  confirm: z.string(),
}).refine((d) => d.passphrase === d.confirm, {
  message: "Passphrases don't match",
  path: ["confirm"],
});

const unlockSchema = z.object({
  passphrase: z.string().min(1, "Enter your passphrase"),
});

const totpConfirmSchema = z.object({
  secret: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const totpRecoverSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit code"),
    passphrase: z
      .string()
      .min(6, "Passphrase must be at least 6 characters")
      .max(128),
    confirm: z.string(),
  })
  .refine((d) => d.passphrase === d.confirm, {
    message: "Passphrases don't match",
    path: ["confirm"],
  });

// ---------- actions ----------

/**
 * First-time passphrase setup. Creates the UserSecurity row.
 * Should only be called when no passphrase exists yet.
 */
export async function setupPassphrase(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  // Prevent double-setup
  const existing = await prisma.userSecurity.findUnique({
    where: { userId: user.id! },
  });
  if (existing) {
    return { status: "error", message: "Passphrase already set. Use change instead." };
  }

  const parsed = setupSchema.safeParse({
    passphrase: formData.get("passphrase"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { hash, salt } = await hashPassphrase(parsed.data.passphrase);
  await prisma.userSecurity.create({
    data: {
      userId: user.id!,
      passphraseHash: hash,
      passphraseSalt: salt,
    },
  });

  // Auto-unlock the current session so the user isn't immediately locked out.
  const token = await getSessionToken();
  if (token) {
    await prisma.session.updateMany({
      where: { sessionToken: token },
      data: { unlockedAt: new Date() },
    });
  }

  return { status: "success", message: "Passphrase set." };
}

/**
 * Change an existing passphrase. Verifies the current one first.
 */
export async function changePassphrase(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const security = await prisma.userSecurity.findUnique({
    where: { userId: user.id! },
  });
  if (!security) {
    return { status: "error", message: "No passphrase set yet." };
  }

  const parsed = changeSchema.safeParse({
    current: formData.get("current"),
    passphrase: formData.get("passphrase"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const valid = await verifyPassphrase(
    parsed.data.current,
    security.passphraseHash,
    security.passphraseSalt,
  );
  if (!valid) {
    return {
      status: "error",
      message: "Current passphrase is incorrect.",
      fieldErrors: { current: ["Wrong passphrase"] },
    };
  }

  const { hash, salt } = await hashPassphrase(parsed.data.passphrase);
  await prisma.userSecurity.update({
    where: { userId: user.id! },
    data: { passphraseHash: hash, passphraseSalt: salt },
  });

  return { status: "success", message: "Passphrase changed." };
}

/**
 * Verify the passphrase and mark the current session as unlocked.
 * Called from the /unlock page. On success, redirects to /dashboard.
 */
export async function unlockSession(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const security = await prisma.userSecurity.findUnique({
    where: { userId: user.id! },
  });
  if (!security) {
    // No passphrase set: shouldn't be on /unlock, redirect away.
    redirect("/dashboard");
  }

  const parsed = unlockSchema.safeParse({
    passphrase: formData.get("passphrase"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const valid = await verifyPassphrase(
    parsed.data.passphrase,
    security.passphraseHash,
    security.passphraseSalt,
  );
  if (!valid) {
    return { status: "error", message: "Wrong passphrase. Try again." };
  }

  return unlockCurrentSessionAndRedirect();
}

// ---------- TOTP recovery ----------
//
// Passphrase-recovery only: proves who you are another way when you've
// forgotten the passphrase, and lets you set a new one in the same step.
// Never a routine second gate — requireUnlocked() never checks this.

/**
 * Generates a fresh secret and its QR code for enrollment. Deliberately not
 * persisted here: only confirmTotpSetup(), after it verifies a real code
 * against this exact secret, writes anything to the database. A setup
 * that's started and abandoned mid-dialog leaves no live, unconfirmed
 * recovery method behind.
 */
export async function generateTotpSecret(): Promise<{
  secretBase32: string;
  qrSvg: string;
}> {
  const user = await requireUser();
  const { secretBase32, otpauthUri } = generateTotpEnrollment(
    user.email ?? "Corpus account",
  );
  const qrSvg = await totpQrSvg(otpauthUri);
  return { secretBase32, qrSvg };
}

/**
 * Confirms a TOTP enrollment: the secret came from generateTotpSecret() and
 * round-trips through a hidden form field, the code is what the user's
 * authenticator app produced from scanning it. Only encrypted and saved on
 * a real match.
 */
export async function confirmTotpSetup(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const security = await prisma.userSecurity.findUnique({
    where: { userId: user.id! },
  });
  if (!security) {
    return { status: "error", message: "Set an app passphrase first." };
  }

  const parsed = totpConfirmSchema.safeParse({
    secret: formData.get("secret"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (!verifyTotpCode(parsed.data.secret, parsed.data.code)) {
    return {
      status: "error",
      message: "That code didn't match. Check the time on your phone and try again.",
      fieldErrors: { code: ["Incorrect code"] },
    };
  }

  await prisma.userSecurity.update({
    where: { userId: user.id! },
    data: {
      totpSecretEnc: encrypt(parsed.data.secret),
      totpEnabledAt: new Date(),
    },
  });

  return { status: "success", message: "Recovery set up." };
}

/** Turns recovery back off. Called directly (see DeleteDialog's pattern), so it revalidates by hand. */
export async function disableTotpRecovery(formData: FormData): Promise<void> {
  void formData; // DeleteDialog always sends one; nothing here needs it.
  const user = await requireUser();
  await prisma.userSecurity.update({
    where: { userId: user.id! },
    data: { totpSecretEnc: null, totpEnabledAt: null },
  });
  revalidatePath("/settings");
}

/**
 * The recovery path itself: called from /unlock's "forgot your passphrase?"
 * link. Verifies a TOTP code instead of the passphrase, then sets a new
 * passphrase and unlocks the session in the same step, since the whole
 * point is the user doesn't have the old one to enter.
 */
export async function recoverWithTotp(
  _prev: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const user = await requireUser();

  const security = await prisma.userSecurity.findUnique({
    where: { userId: user.id! },
  });
  if (!security?.totpSecretEnc) {
    return { status: "error", message: "Recovery isn't set up for this account." };
  }

  const parsed = totpRecoverSchema.safeParse({
    code: formData.get("code"),
    passphrase: formData.get("passphrase"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const secret = decrypt(security.totpSecretEnc);
  if (!verifyTotpCode(secret, parsed.data.code)) {
    return {
      status: "error",
      message: "That code didn't match.",
      fieldErrors: { code: ["Incorrect code"] },
    };
  }

  const { hash, salt } = await hashPassphrase(parsed.data.passphrase);
  await prisma.userSecurity.update({
    where: { userId: user.id! },
    data: { passphraseHash: hash, passphraseSalt: salt },
  });

  return unlockCurrentSessionAndRedirect();
}
