import { prisma } from "@/lib/db";
import { listBudgets, type BudgetWithProgress } from "@/lib/money/budget-queries";
import { buildForecastWithThreshold } from "@/lib/money/cashflow";
import { computeDiscretionaryDaily } from "@/lib/money/discretionary";
import { currentMonth, daysRemainingInMonth } from "@/lib/money/period";
import { listBills } from "@/lib/money/bill-queries";
import { nextExpectedSoon } from "@/lib/money/income-queries";
import { netWorthDashboardSummary } from "@/lib/money/networth";

export type DashboardMoneySummary = {
  totalSpentCents: number;
  totalBudgetedCents: number;
  topCategories: { name: string; spentCents: number; limitCents: number; color: string }[];
  upcomingBills: { count: number; totalCents: number };
  goals: { savedCents: number; targetCents: number; count: number };
  hotBudgets: BudgetWithProgress[];
  daysRemaining: number;
  net: { netCents: number; inCents: number; outCents: number };
  hasIncomeActivity: boolean;
  nextIncome: { name: string; amountCents: number; expectedAt: Date } | null;
  netWorth: { totalCents: number; deltaThisMonthCents: number } | null;
  cashFlow: {
    horizonDays: number;
    netProjectedCents: number;
    firstTightSpot: { at: Date; balanceCents: number } | null;
    tightSpotCount: number;
  } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function moneyDashboardSummary(
  userId: string,
  timezone: string,
  currency: string,
  now: Date = new Date()
): Promise<DashboardMoneySummary> {
  const month = currentMonth(timezone, now);
  const horizon7 = new Date(now.getTime() + 7 * DAY_MS);

  const [
    budgets,
    monthSpend,
    bills,
    goals,
    netAggregate,
    incomeAggregate,
    activeIncomeCount,
    nextIncomeRow,
    netWorth,
    cashFlow
  ] = await Promise.all([
    listBudgets(userId, timezone, now),
    prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId,
        amountCents: { lt: 0 },
        occurredAt: { gte: month.start, lte: month.end }
      },
      _sum: { amountCents: true }
    }),
    listBills(userId, timezone, now),
    prisma.savingsGoal.findMany({
      where: { userId, archived: false },
      select: { savedCents: true, targetCents: true }
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        occurredAt: { gte: month.start, lte: month.end }
      },
      _sum: { amountCents: true }
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        amountCents: { gt: 0 },
        occurredAt: { gte: month.start, lte: month.end }
      },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.incomeSource.count({ where: { userId, active: true } }),
    nextExpectedSoon(userId, 30, now),
    netWorthDashboardSummary(userId, timezone, now),
    buildCashFlowSummary(userId, timezone, now)
  ]);

  const limitByName = new Map(
    budgets.map((b) => [b.name, { limit: b.monthlyLimitCents, color: b.color }])
  );
  const totalBudgetedCents = budgets.reduce((s, b) => s + b.monthlyLimitCents, 0);
  let totalSpentCents = 0;

  const spendRows = monthSpend
    .map((row) => {
      const cents = Math.abs(row._sum.amountCents ?? 0);
      totalSpentCents += cents;
      const name = row.category ?? "Uncategorized";
      const meta = limitByName.get(name);
      return {
        name,
        spentCents: cents,
        limitCents: meta?.limit ?? 0,
        color: meta?.color ?? "#a8a29e"
      };
    })
    .filter((r) => r.spentCents > 0)
    .sort((a, b) => b.spentCents - a.spentCents);

  const topCategories = spendRows.slice(0, 3);

  const upcoming = bills.filter(
    (b) => b.nextDueAt !== null && b.nextDueAt >= now && b.nextDueAt <= horizon7
  );
  const upcomingBills = {
    count: upcoming.length,
    totalCents: upcoming.reduce((s, b) => s + b.amountCents, 0)
  };

  const goalsSummary = {
    savedCents: goals.reduce((s, g) => s + g.savedCents, 0),
    targetCents: goals.reduce((s, g) => s + g.targetCents, 0),
    count: goals.length
  };

  const hotBudgets = budgets.filter((b) => b.percentUsed > 80 && b.daysRemaining > 7);

  const inCents = incomeAggregate._sum.amountCents ?? 0;
  const netCents = netAggregate._sum.amountCents ?? 0;
  const outCents = inCents - netCents; // positive = absolute expense

  const hasIncomeActivity =
    activeIncomeCount > 0 || (incomeAggregate._count ?? 0) > 0;

  const nextIncome = nextIncomeRow
    ? {
        name: nextIncomeRow.name,
        amountCents: nextIncomeRow.expectedAmountCents,
        expectedAt: nextIncomeRow.nextExpectedAt
      }
    : null;

  return {
    totalSpentCents,
    totalBudgetedCents,
    topCategories,
    upcomingBills,
    goals: goalsSummary,
    hotBudgets,
    daysRemaining: daysRemainingInMonth(timezone, now),
    net: { netCents, inCents, outCents },
    hasIncomeActivity,
    nextIncome,
    netWorth,
    cashFlow
  };
}

/**
 * Cash-flow summary for the dashboard line. Loads user prefs + accounts +
 * runs the forecast; returns null when the inputs aren't enough to render
 * a meaningful line (no income source, or no cash-flow accounts).
 */
async function buildCashFlowSummary(
  userId: string,
  timezone: string,
  now: Date
): Promise<DashboardMoneySummary["cashFlow"]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cashFlowHorizonDays: true,
      cashFlowTightThresholdCents: true,
      cashFlowIncludeDiscretionary: true,
      cashFlowDiscretionaryDailyCents: true
    }
  });
  if (!user) return null;

  const [accounts, incomeSourceCount] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId, archived: false, includeInCashFlow: true },
      select: { balanceCents: true, isLiability: true }
    }),
    prisma.incomeSource.count({ where: { userId, active: true } })
  ]);

  if (accounts.length === 0 || incomeSourceCount === 0) return null;

  const startingBalanceCents = accounts.reduce(
    (s, a) => s + (a.isLiability ? -a.balanceCents : a.balanceCents),
    0
  );

  const discretionaryAuto = await computeDiscretionaryDaily(userId, 60, now);
  const discretionaryDailyCents =
    user.cashFlowDiscretionaryDailyCents ?? discretionaryAuto.cents;

  const forecast = await buildForecastWithThreshold({
    userId,
    horizonDays: user.cashFlowHorizonDays,
    startingBalanceCents,
    includeDiscretionary: user.cashFlowIncludeDiscretionary,
    discretionaryDailyCents: user.cashFlowIncludeDiscretionary ? discretionaryDailyCents : 0,
    tightThresholdCents: user.cashFlowTightThresholdCents,
    tz: timezone,
    now
  });

  const netProjectedCents = forecast.events.reduce((s, e) => s + e.amountCents, 0);

  return {
    horizonDays: user.cashFlowHorizonDays,
    netProjectedCents,
    firstTightSpot: forecast.tightSpots[0] ?? null,
    tightSpotCount: forecast.tightSpots.length
  };
}
