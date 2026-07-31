import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { signInWithGoogle } from "@/lib/auth/actions";
import { Wordmark } from "@/components/layout/wordmark";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 md:px-8">
        <Wordmark />
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="w-full max-w-sm">
          <p className="eyebrow rise">Sign in</p>
          <h1
            className="font-display rise mt-3 text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em]"
            style={{ "--delay": "60ms" } as React.CSSProperties}
          >
            Welcome back.
          </h1>
          <p
            className="text-muted-foreground rise mt-3 text-sm leading-relaxed text-balance"
            style={{ "--delay": "120ms" } as React.CSSProperties}
          >
            Only one Google account can sign in here.
          </p>

          <form
            action={signInWithGoogle}
            className="rise mt-8"
            style={{ "--delay": "180ms" } as React.CSSProperties}
          >
            <button
              type="submit"
              className="border-border bg-card hover:border-primary/40 hover:bg-accent focus-visible:ring-ring flex w-full items-center justify-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <GoogleIcon className="size-[1.15rem]" />
              Continue with Google
            </button>
          </form>

          <p
            className="text-muted-foreground rise mt-5 text-xs leading-relaxed"
            style={{ "--delay": "240ms" } as React.CSSProperties}
          >
            Corpus reads your name, email and photo to create the account. A
            passphrase unlocks the session after this step.
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
