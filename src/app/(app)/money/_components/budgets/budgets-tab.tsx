import { AddBudgetButton } from "@/app/(app)/money/_components/budgets/add-budget-button";
import { BudgetCard } from "@/app/(app)/money/_components/budgets/budget-card";
import { OverBudgetBanner } from "@/app/(app)/money/_components/budgets/over-budget-banner";
import type { CandidateCategory } from "@/app/(app)/money/_components/budgets/budget-form";
import type { BudgetWithProgress } from "@/lib/money/budget-queries";

export function BudgetsTab({
  budgets,
  candidates,
  currency
}: {
  budgets: BudgetWithProgress[];
  candidates: CandidateCategory[];
  currency: string;
}) {
  const hot = budgets.filter((b) => b.percentUsed > 80 && b.daysRemaining > 7);

  return (
    <div className="space-y-6">
      <OverBudgetBanner hot={hot} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {budgets.length === 0
            ? "Track a few categories to see how the month's going."
            : `${budgets.length} budget${budgets.length === 1 ? "" : "s"} this month.`}
        </p>
        <AddBudgetButton candidates={candidates} currency={currency} />
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No budgets yet. Set one for a category you want to keep an eye on.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {budgets.map((b) => (
            <BudgetCard key={b.id} budget={b} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}
