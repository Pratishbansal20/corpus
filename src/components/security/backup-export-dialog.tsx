"use client";

import { useState, useTransition } from "react";
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

/**
 * Not a server action: the point is a browser file download, which needs a
 * real fetch + blob, not a server action's JSON-shaped return. Posts to
 * /api/export/backup (POST, not GET, so the passphrase never touches a URL)
 * and turns the response into a download the same way a plain <a download>
 * would, since a POST can't be a plain link.
 */
export function BackupExportDialog() {
  const [open, setOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setPassphrase("");
    setConfirm("");
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passphrase.length < 6) {
      setError("Passphrase must be at least 6 characters");
      return;
    }
    if (passphrase !== confirm) {
      setError("Passphrases don't match");
      return;
    }
    setError(null);

    startTransition(async () => {
      const res = await fetch("/api/export/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Export failed. Try again.");
        return;
      }

      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `corpus-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);

      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Button onClick={() => setOpen(true)}>Download backup</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download an encrypted backup</DialogTitle>
          <DialogDescription>
            Choose a passphrase for this file. You&apos;ll need the exact same
            one to open it again later — it isn&apos;t your app passphrase and
            isn&apos;t stored anywhere.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-xs">
              {error}
            </p>
          )}
          <Field label="Backup passphrase" htmlFor="backup-passphrase">
            <Input
              id="backup-passphrase"
              type="password"
              autoComplete="new-password"
              placeholder="Choose a passphrase"
              minLength={6}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
            />
          </Field>
          <Field label="Confirm passphrase" htmlFor="backup-confirm">
            <Input
              id="backup-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Re-enter passphrase"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Encrypting…" : "Download"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
