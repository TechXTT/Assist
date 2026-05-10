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
import { IncomeSourceForm } from "@/app/(app)/money/_components/income/income-source-form";

export function AddIncomeSourceButton({ currency }: { currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add income source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New income source</DialogTitle>
          <DialogDescription>
            Paycheck, allowance, scholarship — what's coming in and how often.
          </DialogDescription>
        </DialogHeader>
        <IncomeSourceForm mode="create" currency={currency} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
