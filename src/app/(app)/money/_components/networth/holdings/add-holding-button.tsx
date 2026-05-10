"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { HoldingForm } from "@/app/(app)/money/_components/networth/holdings/holding-form";

export function AddHoldingButton({
  accountId,
  accountType
}: {
  accountId: string;
  accountType: "investment" | "crypto";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add holding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New holding</DialogTitle>
          <DialogDescription>
            Ticker, shares, latest price you know. Cost basis is optional.
          </DialogDescription>
        </DialogHeader>
        <HoldingForm
          mode="create"
          accountId={accountId}
          accountType={accountType}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
