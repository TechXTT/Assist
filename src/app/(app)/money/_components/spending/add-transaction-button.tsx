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
import { TransactionForm } from "@/app/(app)/money/_components/spending/transaction-form";
import type { CategoryRow } from "@/lib/money/category-queries";

export function AddTransactionButton({
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
          Log a transaction
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New transaction</DialogTitle>
          <DialogDescription>Quick numbers — you can edit later.</DialogDescription>
        </DialogHeader>
        <TransactionForm
          mode="create"
          categories={categories}
          currency={currency}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
