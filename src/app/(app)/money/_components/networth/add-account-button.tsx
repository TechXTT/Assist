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
import { AccountForm } from "@/app/(app)/money/_components/networth/account-form";

export function AddAccountButton({ currency }: { currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New account</DialogTitle>
          <DialogDescription>
            Cash, savings, investment, credit card — anything with a balance you check.
          </DialogDescription>
        </DialogHeader>
        <AccountForm mode="create" currency={currency} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
