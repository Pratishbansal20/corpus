"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { initialFormState, type FormActionState } from "@/lib/forms/action-state";

type Action = (
  prev: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;

// Reusable add/edit dialog: owns its own trigger button (no JSX crosses the
// server→client boundary), manages open state, and closes on success. The form
// fields are supplied as a render function so they can read validation state.
export function FormDialog({
  trigger,
  label,
  title,
  description,
  submitLabel,
  action,
  className,
  children,
}: {
  trigger: "primary" | "icon";
  label: string;
  title: string;
  description?: string;
  submitLabel: string;
  action: Action;
  className?: string;
  children: (state: FormActionState) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      {trigger === "primary" ? (
        <Button className={className ?? "gap-2"} onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          {label}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={() => setOpen(true)}
        >
          <Pencil className="size-4" />
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {open && (
          <FormBody
            action={action}
            submitLabel={submitLabel}
            onDone={() => setOpen(false)}
          >
            {children}
          </FormBody>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormBody({
  action,
  submitLabel,
  onDone,
  children,
}: {
  action: Action;
  submitLabel: string;
  onDone: () => void;
  children: (state: FormActionState) => ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);

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
      {children(state)}
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>
          Cancel
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
