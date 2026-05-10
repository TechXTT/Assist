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
import { formatCents, parseCentsInput } from "@/lib/money/format";
import { markIncomeReceived } from "@/app/(app)/money/actions";

export function MarkReceivedDialog({
  open,
  onOpenChange,
  sourceId,
  sourceName,
  expectedAmountCents,
  currency,
  cadence
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceId: string;
  sourceName: string;
  expectedAmountCents: number;
  currency: string;
  cadence: string;
}) {
  const [amount, setAmount] = useState((expectedAmountCents / 100).toString());
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pending, start] = useTransition();

  function reset() {
    setAmount((expectedAmountCents / 100).toString());
    setDate(format(new Date(), "yyyy-MM-dd"));
  }

  function onConfirm() {
    const cents = parseCentsInput(amount);
    if (cents === null || cents <= 0) {
      toast.error("Pick an amount above zero.");
      return;
    }
    start(async () => {
      try {
        const result = await markIncomeReceived(sourceId, {
          actualAmountCents: cents,
          receivedAt: new Date(`${date}T00:00:00`).toISOString()
        });
        toast.success(`+ ${formatCents(result.amountCents, result.currency)} received from ${sourceName}.`);
        if (cadence === "oneoff") {
          toast.message("Marked received. Done.");
        } else if (result.nextExpectedAt) {
          toast.message(
            `Marked received. Next cycle: ${format(result.nextExpectedAt, "d MMM")}.`
          );
        }
        reset();
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't mark received.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark received — {sourceName}</DialogTitle>
          <DialogDescription>Confirm the amount and date.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="received-amount">Amount</Label>
            <Input
              id="received-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="received-date">Date</Label>
            <Input
              id="received-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Marking…" : "Mark received"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
