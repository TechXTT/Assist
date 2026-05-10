import { prisma } from "@/lib/db";

import { currentMonth } from "@/lib/money/period";

export type TransactionRow = {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  category: string | null;
  occurredAt: Date;
  source: string;
};

export async function listTransactions(
  userId: string,
  opts: { from: Date; to: Date; categoryNames?: string[] }
): Promise<TransactionRow[]> {
  return prisma.transaction.findMany({
    where: {
      userId,
      occurredAt: { gte: opts.from, lte: opts.to },
      ...(opts.categoryNames && opts.categoryNames.length > 0
        ? { category: { in: opts.categoryNames } }
        : {})
    },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      amountCents: true,
      currency: true,
      description: true,
      category: true,
      occurredAt: true,
      source: true
    }
  });
}

export type CategoryBreakdown = {
  total: number; // total expense cents (positive)
  byCategory: { category: string; amountCents: number; color: string }[];
};

/**
 * Sum negative-amount transactions (expenses) in the current calendar month
 * grouped by category. Returns absolute values and a stable category color
 * pulled from BudgetCategory when available.
 */
export async function monthlyBreakdown(
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<CategoryBreakdown> {
  const { start, end } = currentMonth(timezone, now);

  const [rows, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId,
        amountCents: { lt: 0 },
        occurredAt: { gte: start, lte: end }
      },
      _sum: { amountCents: true }
    }),
    prisma.budgetCategory.findMany({
      where: { userId },
      select: { name: true, color: true }
    })
  ]);

  const colorByName = new Map(categories.map((c) => [c.name, c.color]));
  const byCategory = rows
    .map((r) => {
      const cents = Math.abs(r._sum.amountCents ?? 0);
      const name = r.category ?? "Uncategorized";
      return {
        category: name,
        amountCents: cents,
        color: colorByName.get(name) ?? "#a8a29e"
      };
    })
    .filter((r) => r.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);

  const total = byCategory.reduce((sum, r) => sum + r.amountCents, 0);
  return { total, byCategory };
}
