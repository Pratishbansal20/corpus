import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { auth } from "@/auth";
import { hasPassphrase } from "@/lib/security/queries";
import { Wordmark } from "@/components/layout/wordmark";
import { UnlockForm } from "./unlock-form";

// The /unlock page lives outside the (dashboard) group so it isn't subject to
// requireUnlocked() (which would cause an infinite redirect loop). It still
// requires a signed-in user via auth().
export default async function UnlockPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // If the user hasn't set a passphrase yet, skip straight to dashboard.
  const hasPp = await hasPassphrase(session.user.id!);
  if (!hasPp) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 md:px-8">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="w-full max-w-sm">
          <span className="bg-primary/10 text-primary rise flex size-11 items-center justify-center rounded-xl">
            <Lock className="size-5" />
          </span>
          <h1
            className="font-display rise mt-5 text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em]"
            style={{ "--delay": "60ms" } as React.CSSProperties}
          >
            Locked.
          </h1>
          <p
            className="text-muted-foreground rise mt-3 text-sm leading-relaxed text-balance"
            style={{ "--delay": "120ms" } as React.CSSProperties}
          >
            Enter your passphrase to open this session.
          </p>
          <div
            className="rise mt-8"
            style={{ "--delay": "180ms" } as React.CSSProperties}
          >
            <UnlockForm />
          </div>
        </div>
      </main>
    </div>
  );
}
