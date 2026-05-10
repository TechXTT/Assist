import { prisma } from "@/lib/db";

import { currentMonth, daysRemainingInMonth } from "@/lib/money/period";

export type BudgetWithProgress = {
  id: string;
  name: string;
  color: string;
  monthlyLimitCents: number;
  spentCents: number;
  percentUsed: number;
  daysRemaining: number;
};

/**
 * List the user's active budgets (non-archived BudgetCategory rows with a
 * non-zero monthlyLimitCents), joined with this-month expense totals.
 * Sorted: hot ones first (highest percentUsed), then alphabetical.
 */
export async function listBudgets(
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<BudgetWithProgress[]> {
  const { start, end } = currentMonth(timezone, now);

  const [budgets, spendByCategory] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: {
        userId,
        archived: false,
        monthlyLimitCents: { gt: 0 }
      },
      select: {
        id: true,
        name: true,
        color: true,
        monthlyLimitCents: true
      }
    }),
    prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId,
        amountCents: { lt: 0 },
        occurredAt: { gte: start, lte: end }
      },
      _sum: { amountCents: true }
    })
  ]);

  const spentByName = new Map<string, number>();
  for (const row of spendByCategory) {
    if (!row.category) continue;
    spentByName.set(row.category, Math.abs(row._sum.amountCents ?? 0));
  }

  const daysRemaining = daysRemainingInMonth(timezone, now);

  return budgets
    .map<BudgetWithProgress>((b) => {
      const spentCents = spentByName.get(b.name) ?? 0;
      const percentUsed =
        b.monthlyLimitCents > 0
          ? Math.round((spentCents / b.monthlyLimitCents) * 100)
          : 0;
      return {
        id: b.id,
        name: b.name,
        color: b.color,
        monthlyLimitCents: b.monthlyLimitCents,
        spentCents,
        percentUsed,
        daysRemaining
      };
    })
    .sort((a, b) => {
      if (a.percentUsed !== b.percentUsed) return b.percentUsed - a.percentUsed;
      return a.name.localeCompare(b.name);
    });
}
