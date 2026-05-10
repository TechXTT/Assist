"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/money/format";
import { BudgetForm } from "@/app/(app)/money/_components/budgets/budget-form";
import { ArchiveBudgetDialog } from "@/app/(app)/money/_components/budgets/archive-budget-dialog";
import type { BudgetWithProgress } from "@/lib/money/budget-queries";

function barClass(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct >= 80) return "bg-orange-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-stone-400";
}

function metaCopy(b: BudgetWithProgress, currency: string): string {
  const days = `${b.daysRemaining} ${b.daysRemaining === 1 ? "day" : "days"} left`;
  if (b.percentUsed > 100) {
    const over = b.spentCents - b.monthlyLimitCents;
    return `${formatCents(over, currency)} over the ${formatCents(b.monthlyLimitCents, currency)} limit. ${days} in the month.`;
  }
  return `${formatCents(b.spentCents, currency)} of ${formatCents(b.monthlyLimitCents, currency)} · ${days}`;
}

export function BudgetCard({
  budget,
  currency
}: {
  budget: BudgetWithProgress;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const fillPct = Math.min(100, budget.percentUsed);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: budget.color }}
          />
          <h3 className="flex-1 truncate text-sm font-medium">{budget.name}</h3>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {budget.percentUsed}%
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${budget.name} budget`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <ArchiveBudgetDialog budgetId={budget.id} name={budget.name} />
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", barClass(budget.percentUsed))}
            style={{ width: `${fillPct}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">{metaCopy(budget, currency)}</p>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit budget — {budget.name}</DialogTitle>
            <DialogDescription>Tweak the limit or pick a different color.</DialogDescription>
          </DialogHeader>
          <BudgetForm
            mode="edit"
            currency={currency}
            budgetId={budget.id}
            defaultValues={{
              name: budget.name,
              color: budget.color,
              limit: (budget.monthlyLimitCents / 100).toString()
            }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
