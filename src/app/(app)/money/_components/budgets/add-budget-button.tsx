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
import {
  BudgetForm,
  type CandidateCategory
} from "@/app/(app)/money/_components/budgets/budget-form";

export function AddBudgetButton({
  candidates,
  currency
}: {
  candidates: CandidateCategory[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Set a budget
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>
            Pick a category to keep an eye on, and set a monthly limit.
          </DialogDescription>
        </DialogHeader>
        <BudgetForm
          mode="create"
          currency={currency}
          candidates={candidates}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
