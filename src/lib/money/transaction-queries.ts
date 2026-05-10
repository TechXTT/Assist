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

export type TransactionTypeFilter = "all" | "expenses" | "income";

function signFilter(type: TransactionTypeFilter | undefined) {
  if (type === "expenses") return { amountCents: { lt: 0 } };
  if (type === "income") return { amountCents: { gt: 0 } };
  return {};
}

export async function listTransactions(
  userId: string,
  opts: {
    from: Date;
    to: Date;
    categoryNames?: string[];
    type?: TransactionTypeFilter;
  }
): Promise<TransactionRow[]> {
  return prisma.transaction.findMany({
    where: {
      userId,
      occurredAt: { gte: opts.from, lte: opts.to },
      ...(opts.categoryNames && opts.categoryNames.length > 0
        ? { category: { in: opts.categoryNames } }
        : {}),
      ...signFilter(opts.type)
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

/**
 * Aggregate of positive-amount transactions in the current calendar month —
 * used for the Spending tab's "+ N income transactions this month" hint and
 * the Income view's "Received €X" caption.
 */
export async function monthlyIncomeSummary(
  userId: string,
  monthStart: Date,
  monthEnd: Date
): Promise<{ count: number; totalCents: number }> {
  const result = await prisma.transaction.aggregate({
    where: {
      userId,
      amountCents: { gt: 0 },
      occurredAt: { gte: monthStart, lte: monthEnd }
    },
    _sum: { amountCents: true },
    _count: true
  });
  return {
    count: result._count ?? 0,
    totalCents: result._sum.amountCents ?? 0
  };
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
