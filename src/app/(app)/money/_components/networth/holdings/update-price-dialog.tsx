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
import { updatePrice } from "@/app/(app)/money/actions";

export function UpdatePriceDialog({
  open,
  onOpenChange,
  holdingId,
  ticker,
  currentPriceCents,
  currency
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdingId: string;
  ticker: string;
  currentPriceCents: number;
  currency: string;
}) {
  const [price, setPrice] = useState((currentPriceCents / 100).toString());
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pending, start] = useTransition();

  function onConfirm() {
    const cents = parseCentsInput(price);
    if (cents === null || cents < 0) {
      toast.error("That doesn't look like a number.");
      return;
    }
    start(async () => {
      try {
        await updatePrice(holdingId, {
          lastKnownPriceCents: cents,
          lastPriceUpdate: new Date(`${date}T00:00:00`).toISOString()
        });
        toast.success(`Price updated. ${ticker} → ${formatCents(cents, currency)}.`);
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
          <DialogTitle>Update price — {ticker}</DialogTitle>
          <DialogDescription>The latest per-share figure you saw.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hp-price">Latest price</Label>
            <Input
              id="hp-price"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hp-date">As of</Label>
            <Input id="hp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
