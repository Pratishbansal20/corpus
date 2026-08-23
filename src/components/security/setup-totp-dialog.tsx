"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/fields";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateTotpSecret, confirmTotpSetup } from "@/lib/security/actions";
import { initialFormState } from "@/lib/forms/action-state";

/**
 * Two steps in one dialog: generate a secret + QR on open (generateTotpSecret,
 * called directly, not persisted), then confirm a real code from the
 * authenticator app before anything is saved (confirmTotpSetup). This is
 * recovery for a forgotten passphrase, not a routine second gate — the
 * description here says that outright so it isn't mistaken for 2FA on every
 * sign-in.
 */
export function SetupTotpDialog() {
  const [open, setOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<
    { secretBase32: string; qrSvg: string } | "loading" | null
  >(null);

  useEffect(() => {
    if (!open) return;
    // Deferred a tick (same fix as count-up.tsx): a setState call directly
    // in an effect body runs synchronously as part of mounting/updating,
    // which the setTimeout here avoids without any visible delay.
    const timer = setTimeout(() => {
      setEnrollment("loading");
      generateTotpSecret().then(setEnrollment);
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        // A real event, not an effect: safe to reset state directly here,
        // so the next open starts from "loading" instead of briefly
        // flashing the previous secret's QR code.
        if (!o) setEnrollment(null);
      }}
    >
      <Button onClick={() => setOpen(true)}>Set up recovery</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set up passphrase recovery</DialogTitle>
          <DialogDescription>
            For when you forget your passphrase, not a second step every time
            you unlock. Scan this with an authenticator app (Google
            Authenticator, Authy, 1Password, anything TOTP-based).
          </DialogDescription>
        </DialogHeader>
        {enrollment === "loading" || enrollment === null ? (
          <div className="skeleton mx-auto h-[220px] w-[220px] rounded-lg" />
        ) : (
          <ConfirmStep
            enrollment={enrollment}
            onDone={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmStep({
  enrollment,
  onDone,
}: {
  enrollment: { secretBase32: string; qrSvg: string };
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    confirmTotpSetup,
    initialFormState,
  );

  useEffect(() => {
    if (state.status === "success") onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.status === "error" && state.message && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
          {state.message}
        </p>
      )}

      <div
        className="mx-auto [&_svg]:rounded-lg [&_svg]:bg-white [&_svg]:p-2"
        // The SVG markup comes from qrcode's own server-side renderer, fed
        // only the otpauth:// URI this dialog itself generated — not
        // user-controlled input, so this is not an XSS-injection surface.
        dangerouslySetInnerHTML={{ __html: enrollment.qrSvg }}
      />

      <details className="text-muted-foreground text-xs">
        <summary className="cursor-pointer">Can&apos;t scan? Enter this key manually</summary>
        <code className="mt-2 block break-all rounded-md bg-muted/60 px-2.5 py-1.5 font-mono">
          {enrollment.secretBase32}
        </code>
      </details>

      <input type="hidden" name="secret" value={enrollment.secretBase32} />

      <Field
        label="6-digit code"
        htmlFor="code"
        error={state.fieldErrors?.code}
        hint="From the app, after scanning."
      >
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
        />
      </Field>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Confirming…" : "Confirm"}
        </Button>
      </DialogFooter>
    </form>
  );
}
