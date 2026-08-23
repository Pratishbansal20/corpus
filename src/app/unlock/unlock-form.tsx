"use client";

import { useActionState, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/fields";
import { unlockSession, recoverWithTotp } from "@/lib/security/actions";
import { initialFormState } from "@/lib/forms/action-state";

export function UnlockForm({ canRecover }: { canRecover: boolean }) {
  const [recovering, setRecovering] = useState(false);

  if (recovering) {
    return <RecoverForm onBack={() => setRecovering(false)} />;
  }

  return (
    <PassphraseForm
      onForgot={canRecover ? () => setRecovering(true) : undefined}
    />
  );
}

function PassphraseForm({ onForgot }: { onForgot?: () => void }) {
  const [state, formAction, pending] = useActionState(
    unlockSession,
    initialFormState,
  );

  // On success the server action calls redirect("/dashboard"), so we don't
  // need to handle success on the client side. But if it somehow does
  // return success, we can redirect manually as a fallback.
  useEffect(() => {
    if (state.status === "success") {
      window.location.href = "/dashboard";
    }
  }, [state]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {state.status === "error" && state.message && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
          {state.message}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passphrase">Passphrase</Label>
        <Input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="Enter your passphrase"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Verifying…" : "Unlock"}
      </Button>
      {onForgot && (
        <button
          type="button"
          onClick={onForgot}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline"
        >
          Forgot your passphrase?
        </button>
      )}
    </form>
  );
}

function RecoverForm({ onBack }: { onBack: () => void }) {
  const [state, formAction, pending] = useActionState(
    recoverWithTotp,
    initialFormState,
  );

  useEffect(() => {
    if (state.status === "success") {
      window.location.href = "/dashboard";
    }
  }, [state]);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        Enter the 6-digit code from your authenticator app, then choose a new
        passphrase.
      </p>
      {state.status === "error" && state.message && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
          {state.message}
        </p>
      )}
      <Field label="6-digit code" htmlFor="code" error={state.fieldErrors?.code}>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="123456"
          maxLength={6}
        />
      </Field>
      <Field
        label="New passphrase"
        htmlFor="passphrase"
        error={state.fieldErrors?.passphrase}
      >
        <Input
          id="passphrase"
          name="passphrase"
          type="password"
          autoComplete="new-password"
          placeholder="Enter a new passphrase"
          minLength={6}
        />
      </Field>
      <Field
        label="Confirm new passphrase"
        htmlFor="confirm"
        error={state.fieldErrors?.confirm}
      >
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter new passphrase"
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Verifying…" : "Set new passphrase"}
      </Button>
      <button
        type="button"
        onClick={onBack}
        className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 transition-colors hover:underline"
      >
        Back to passphrase entry
      </button>
    </form>
  );
}
