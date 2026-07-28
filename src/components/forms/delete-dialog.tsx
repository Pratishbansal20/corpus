"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Generic confirm-and-delete. The server action is passed in as a prop (server
// action references serialize fine across the boundary).
export function DeleteDialog({
  id,
  name,
  title = "Delete",
  action,
}: {
  id: string;
  name: string;
  title?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await action(fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={title}
        className="text-muted-foreground hover:text-loss"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Remove <span className="text-foreground font-medium">{name}</span>?
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
