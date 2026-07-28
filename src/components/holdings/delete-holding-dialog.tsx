"use client";

import * as React from "react";
import { useTransition } from "react";
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
import { deleteHolding } from "@/lib/holdings/actions";

export function DeleteHoldingDialog({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteHolding(fd);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Delete holding"
        className="text-muted-foreground hover:text-loss"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete holding</DialogTitle>
          <DialogDescription>
            Remove <span className="text-foreground font-medium">{name}</span>{" "}
            from your portfolio? This can&apos;t be undone.
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
