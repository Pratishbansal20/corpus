import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";

// Auth.js v5 reads AUTH_SECRET, AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET from env.
// Database sessions (backed by the Session/Account tables) keep us multi-user-ready
// and let us revoke sessions server-side: at the cost of a DB hit per request,
// which is fine at personal scale.
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/login" },
  trustHost: true,
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    // Email allowlist: only the owner's Google account may sign in. If
    // OWNER_EMAIL is unset (local dev), all accounts are allowed through.
    signIn({ user }) {
      const owner = process.env.OWNER_EMAIL;
      if (!owner) return true;
      return user.email === owner;
    },
    // Expose the user id on the session so server code can scope queries by user.
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  providers: [Google],
});
