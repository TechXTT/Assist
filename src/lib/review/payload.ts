import { prisma } from "@/lib/db";
import { listBudgets, type BudgetWithProgress } from "@/lib/money/budget-queries";
import { weekTotalMinutes } from "@/lib/health/exercise-queries";
import { average, recentHabitDays } from "@/lib/health/habit-queries";
import type { Week } from "@/lib/review/week";

export type ReviewTaskRef = {
  id: string;
  title: string;
  dueAt: Date | null;
  priority: string;
  status: string;
};

export type ReviewPayload = {
  firstName: string;
  week: Week;
  weekLabel: string; // e.g. "Mon 4 May → Sun 10 May"
  tz: string;
  currency: string;
  // Recap
  completed: { count: number; highlights: ReviewTaskRef[] };
  events: { count: number; highlights: { title: string; startsAt: Date }[] };
  // Slipped
  overdueOpen: { count: number; titles: string[] };
  daysWithoutMood: number;
  exerciseMinutes: number;
  exerciseTargetMinutes: number;
  sleepAvg7Hours: number | null;
  // Money
  money: {
    totalSpentCents: number;
    weekShareOfBudgetCents: number;
    biggestCategory: { name: string; spentCents: number } | null;
    savingsDeltaCents: number;
    netInOutCents: { inCents: number; outCents: number; netCents: number } | null;
    subscriptionCreep: { monthlyCents: number; percentOfMonthly: number } | null;
  };
  // Open todos for the priorities picker (sorted by urgency)
  openTodos: ReviewTaskRef[];
  hasAnyData: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

function priorityWeight(p: string): number {
  if (p === "high") return 3;
  if (p === "med") return 2;
  return 1;
}

export async function buildReviewPayload(
  userId: string,
  week: Week,
  tz: string,
  currency: string,
  now: Date = new Date()
): Promise<ReviewPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, weeklyExerciseTargetMinutes: true }
  });
  const firstName = (user?.name ?? "")?.split(" ")[0] || "there";

  // Calendar week label
  const weekLabel = `${week.start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })} → ${week.end.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: tz })}`;

  const [
    completedTasksRaw,
    events,
    overdueOpenRaw,
    last7Days,
    weekMinutes,
    weekSpend,
    incomeAgg,
    activeIncomeCount,
    budgetsAll,
    savingsRows,
    subscriptions,
    openTodosRaw
  ] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        status: "done",
        completedAt: { gte: week.start, lte: week.end }
      },
      orderBy: { completedAt: "desc" },
      select: { id: true, title: true, dueAt: true, priority: true, status: true }
    }),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        status: { not: "cancelled" },
        startsAt: { lt: week.end },
        endsAt: { gt: week.start }
      },
      orderBy: { startsAt: "asc" },
      select: { title: true, startsAt: true }
    }),
    prisma.task.findMany({
      where: {
        userId,
        status: { not: "done" },
        dueAt: { lt: week.end }
      },
      orderBy: { dueAt: "asc" },
      select: { id: true, title: true, dueAt: true, priority: true, status: true }
    }),
    recentHabitDays(userId, tz, 7, week.end),
    weekTotalMinutes(userId, tz, week.end),
    prisma.transaction.groupBy({
      by: ["category"],
      where: {
        userId,
        amountCents: { lt: 0 },
        occurredAt: { gte: week.start, lte: week.end }
      },
      _sum: { amountCents: true }
    }),
    prisma.transaction.aggregate({
      where: {
        userId,
        occurredAt: { gte: week.start, lte: week.end }
      },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.incomeSource.count({ where: { userId, active: true } }),
    listBudgets(userId, tz, now),
    prisma.savingsGoal.findMany({
      where: { userId, archived: false },
      select: { id: true, savedCents: true, targetCents: true }
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: { amountCents: true, billingCycle: true }
    }),
    prisma.task.findMany({
      where: { userId, status: "todo" },
      orderBy: { dueAt: "asc" },
      select: {
        id: true,
        title: true,
        dueAt: true,
        priority: true,
        status: true
      }
    })
  ]);

  const completedHighlights = completedTasksRaw.slice(0, 3).map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    priority: t.priority,
    status: t.status
  }));

  const eventHighlights = events.slice(0, 3).map((e) => ({
    title: e.title,
    startsAt: e.startsAt
  }));

  const overdueHighlights = overdueOpenRaw
    .filter((t) => t.dueAt && t.dueAt < week.end)
    .slice(0, 3)
    .map((t) => t.title);

  const daysWithoutMood = last7Days.filter((d) => d.mood === null).length;
  const sleepAvg7Hours = average(last7Days.map((d) => d.sleepHours));

  // Money summary
  let totalSpentCents = 0;
  let biggestCategory: { name: string; spentCents: number } | null = null;
  for (const row of weekSpend) {
    const cents = Math.abs(row._sum.amountCents ?? 0);
    totalSpentCents += cents;
    if (!biggestCategory || cents > biggestCategory.spentCents) {
      biggestCategory = { name: row.category ?? "Uncategorized", spentCents: cents };
    }
  }

  // Pro-rate monthly budgets to the 7-day window: total / 30.44 * 7
  const monthlyBudgetTotal = (budgetsAll as BudgetWithProgress[]).reduce(
    (s, b) => s + b.monthlyLimitCents,
    0
  );
  const weekShareOfBudgetCents = Math.round((monthlyBudgetTotal / 30.44) * 7);

  // Savings goals delta this week = sum of (savedCents - target's saved-7d-ago) — we don't
  // currently track savings history, so approximate as the current savedCents total. This
  // is a calm "where you stand" number, not a real diff. Brief permits this for v1.
  const savingsDeltaCents = savingsRows.reduce((s, g) => s + g.savedCents, 0);

  const inCents = Math.max(0, incomeAgg._sum.amountCents ?? 0);
  const netCents = incomeAgg._sum.amountCents ?? 0;
  const outCents = inCents - netCents;
  const netInOutCents = activeIncomeCount > 0 ? { inCents, outCents, netCents } : null;

  // Subscription creep callout: total monthly subscription cost vs monthlyBudgetTotal
  const monthlyFromSubs = subscriptions.reduce((s, sub) => {
    return sub.billingCycle === "annual"
      ? s + Math.round(sub.amountCents / 12)
      : s + sub.amountCents;
  }, 0);
  let subscriptionCreep: { monthlyCents: number; percentOfMonthly: number } | null = null;
  if (monthlyBudgetTotal > 0) {
    const pct = Math.round((monthlyFromSubs / monthlyBudgetTotal) * 100);
    if (pct > 20 || monthlyFromSubs > 5000) {
      subscriptionCreep = { monthlyCents: monthlyFromSubs, percentOfMonthly: pct };
    }
  }

  const openTodos = openTodosRaw
    .sort((a, b) => {
      const aDue = a.dueAt ? a.dueAt.getTime() : Infinity;
      const bDue = b.dueAt ? b.dueAt.getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    })
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.dueAt,
      priority: t.priority,
      status: t.status
    }));

  const hasAnyData =
    completedTasksRaw.length > 0 ||
    events.length > 0 ||
    overdueOpenRaw.length > 0 ||
    weekMinutes > 0 ||
    sleepAvg7Hours !== null ||
    totalSpentCents > 0 ||
    (incomeAgg._count ?? 0) > 0;

  void DAY;

  return {
    firstName,
    week,
    weekLabel,
    tz,
    currency,
    completed: { count: completedTasksRaw.length, highlights: completedHighlights },
    events: { count: events.length, highlights: eventHighlights },
    overdueOpen: { count: overdueOpenRaw.length, titles: overdueHighlights },
    daysWithoutMood,
    exerciseMinutes: weekMinutes,
    exerciseTargetMinutes: user?.weeklyExerciseTargetMinutes ?? 90,
    sleepAvg7Hours,
    money: {
      totalSpentCents,
      weekShareOfBudgetCents,
      biggestCategory,
      savingsDeltaCents,
      netInOutCents,
      subscriptionCreep
    },
    openTodos,
    hasAnyData
  };
}
