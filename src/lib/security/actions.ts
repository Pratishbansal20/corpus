"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/require-user";
import type { FormActionState } from "@/lib/forms/action-state";
import { hashPassphrase, verifyPassphrase } from "./passphrase";
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

  // Set unlockedAt on the current session.
  const token = await getSessionToken();
  if (token) {
    await prisma.session.updateMany({
      where: { sessionToken: token },
      data: { unlockedAt: new Date() },
    });
  }

  redirect("/dashboard");
}
