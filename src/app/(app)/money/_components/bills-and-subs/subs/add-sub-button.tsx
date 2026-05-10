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
import { SubForm } from "@/app/(app)/money/_components/bills-and-subs/subs/sub-form";
import type { CategoryRow } from "@/lib/money/category-queries";

export function AddSubButton({
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
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add subscription
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New subscription</DialogTitle>
          <DialogDescription>The recurring charge — monthly or annual.</DialogDescription>
        </DialogHeader>
        <SubForm
          mode="create"
          categories={categories}
          currency={currency}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
