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
import { BillForm } from "@/app/(app)/money/_components/bills-and-subs/bills/bill-form";
import type { CategoryRow } from "@/lib/money/category-queries";

export function AddBillButton({
  categories,
  currency
}: {
  categories: CategoryRow[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add bill
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New bill</DialogTitle>
          <DialogDescription>Recurring or one-off — your choice.</DialogDescription>
        </DialogHeader>
        <BillForm
          mode="create"
          categories={categories}
          currency={currency}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
