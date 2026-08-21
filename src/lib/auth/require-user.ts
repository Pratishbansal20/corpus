import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

// Returns the signed-in user, redirecting to /login if there's no session.
// Use this in server components and server actions before any per-user query so
// every data path is scoped to session.user.id and can never leak across users.
//
// Wrapped in React's cache(): auth() is a database-session lookup (a real DB
// round trip, not free), and every dashboard page calls requireUser() again
// on top of the layout's own call inside requireUnlocked(). Auth.js does not
// deduplicate that itself (checked: no cache() anywhere in its RSC auth()
// path), so without this every navigation paid for the same session lookup
// twice. cache() only memoizes within one request, so it changes nothing
// about what's checked or how often a genuinely new request re-verifies —
// it just stops one request from asking the same question twice.
export const requireUser = cache(async function requireUser() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  // Defense-in-depth: re-check the email allowlist even after sign-in, so a
  // revoked owner email can't use an existing session.
  const owner = process.env.OWNER_EMAIL;
  if (owner && session.user.email !== owner) {
    redirect("/login");
  }
  return session.user;
});

// Auth.js session token cookie names (differ by HTTPS / HTTP).
const SESSION_COOKIE_PROD = "__Secure-authjs.session-token";
const SESSION_COOKIE_DEV = "authjs.session-token";

/**
 * Like `requireUser()`, but also ensures the session has been unlocked with
 * the app passphrase. If no passphrase has been set yet (first-run), the user
 * is allowed through so they can reach Settings to set one.
 *
 * Use this in the `(dashboard)` layout to gate all protected pages.
 *
 * The two DB reads below (`userSecurity`, `session`) run in parallel rather
 * than one-after-the-other. They were sequential only because the code was
 * written top-to-bottom, not because either depends on the other's result:
 * the session token comes from the request cookie (already available,
 * synchronous, no DB) and is not derived from the `userSecurity` row. Running
 * them concurrently removes one more full round trip to Neon from the
 * security gate that sits in front of every single dashboard page. The
 * *decision* logic afterward is untouched, checked in the exact same order
 * as before: no passphrase set → let through; no cookie → /login; no
 * `unlockedAt` → /unlock. The only behavioural difference is that the
 * session lookup now also runs on the one-time first-run path (no
 * passphrase yet), where its result is simply discarded — a harmless read,
 * scoped to the caller's own cookie, in exchange for saving a round trip on
 * every day after that first run.
 */
export async function requireUnlocked() {
  const user = await requireUser();

  const jar = await cookies();
  const sessionToken =
    jar.get(SESSION_COOKIE_PROD)?.value ?? jar.get(SESSION_COOKIE_DEV)?.value;

  const [security, dbSession] = await Promise.all([
    prisma.userSecurity.findUnique({
      where: { userId: user.id! },
      select: { id: true },
    }),
    sessionToken
      ? prisma.session.findUnique({
          where: { sessionToken },
          select: { unlockedAt: true },
        })
      : Promise.resolve(null),
  ]);

  // If the user hasn't set up a passphrase yet, let them through so they can
  // reach Settings and set one up (first-run experience). The session lookup
  // above still ran, but nothing here reads its result in that case.
  if (!security) return user;

  // Passphrase exists: the session must carry a cookie and be unlocked.
  if (!sessionToken) redirect("/login");
  if (!dbSession?.unlockedAt) {
    redirect("/unlock");
  }

  return user;
}
