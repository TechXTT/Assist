"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents, parseCentsInput } from "@/lib/money/format";
import { updateAccountBalance } from "@/app/(app)/money/actions";

export function UpdateBalanceDialog({
  open,
  onOpenChange,
  accountId,
  accountName,
  currentBalanceCents,
  currency
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountName: string;
  currentBalanceCents: number;
  currency: string;
}) {
  const [amount, setAmount] = useState((currentBalanceCents / 100).toString());
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  function reset() {
    setAmount((currentBalanceCents / 100).toString());
    setDate(format(new Date(), "yyyy-MM-dd"));
    setNote("");
  }

  function onConfirm() {
    const cents = parseCentsInput(amount);
    if (cents === null || cents < 0) {
      toast.error("That doesn't look like a number.");
      return;
    }
    start(async () => {
      try {
        const result = await updateAccountBalance(accountId, {
          newBalanceCents: cents,
          takenAt: new Date(`${date}T00:00:00`).toISOString(),
          note: note.trim() || null
        });
        toast.success(
          `Updated. ${formatCents(result.previousCents, currency)} → ${formatCents(
            result.nextCents,
            currency
          )}.`
        );
        reset();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update balance — {accountName}</DialogTitle>
          <DialogDescription>Punch in the latest number you saw.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="balance-amount">New balance</Label>
            <Input
              id="balance-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance-date">Date</Label>
            <Input
              id="balance-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="balance-note">Note (optional)</Label>
            <Textarea
              id="balance-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Source, context, anything…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Updating…" : "Update"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
