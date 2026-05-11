import { endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";
import { listBudgets } from "@/lib/money/budget-queries";
import { listBills } from "@/lib/money/bill-queries";
import { currentMonth } from "@/lib/money/period";
import { weekTotalMinutes } from "@/lib/health/exercise-queries";
import { average, recentHabitDays } from "@/lib/health/habit-queries";

export type BriefingTaskRef = {
  id: string;
  title: string;
  dueAt: Date | null;
  priority: string;
};

export type BriefingEventRef = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

export type BriefingPayload = {
  firstName: string;
  forDate: Date;
  tz: string;
  currency: string;
  // Section 1+2: opener + today's plan
  todaysEvents: BriefingEventRef[];
  todaysTasks: BriefingTaskRef[];
  // Section 3: top 3 priorities (deadline urgency + priority)
  topPriorities: BriefingTaskRef[];
  // Section 4: money corner
  money: {
    upcomingBills: { count: number; totalCents: number };
    overBudget: { name: string; percentUsed: number }[];
    netMonthCents: number | null; // null when no income activity at all
  };
  // Section 5: health snapshot
  health: {
    sleepAvg7Hours: number | null;
    exerciseWeekMinutes: number;
    exerciseTargetMinutes: number;
    latestMood: number | null;
  };
  // Section 6: tiny-first-step for the stalest task
  stalest: { id: string; title: string; tinyStep: string } | null;
  // True when there's enough activity to brief at all
  hasAnyData: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

function dayBoundsUtc(forDate: Date, tz: string): { start: Date; end: Date } {
  const local = toZonedTime(forDate, tz);
  return {
    start: fromZonedTime(startOfDay(local), tz),
    end: fromZonedTime(endOfDay(local), tz)
  };
}

function priorityWeight(p: string): number {
  if (p === "high") return 3;
  if (p === "med") return 2;
  return 1;
}

export async function buildBriefingPayload(
  userId: string,
  forDate: Date,
  tz: string,
  currency: string
): Promise<BriefingPayload> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });
  const firstName = (user?.name ?? "")?.split(" ")[0] || null;

  const { start, end } = dayBoundsUtc(forDate, tz);
  const now = forDate;
  const horizon7 = new Date(now.getTime() + 7 * DAY);
  const month = currentMonth(tz, now);

  const [todaysEventsRaw, todaysTasksRaw, weekDeadlinesRaw, budgets, bills, netAggregate, incomeCount, weekMinutes, last14, stalestRaw] =
    await Promise.all([
      prisma.calendarEvent.findMany({
        where: {
          userId,
          status: { not: "cancelled" },
          startsAt: { lt: end },
          endsAt: { gt: start }
        },
        orderBy: { startsAt: "asc" },
        select: { title: true, startsAt: true, endsAt: true, allDay: true }
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: { not: "done" },
          dueAt: { gte: start, lte: end }
        },
        orderBy: { dueAt: "asc" },
        select: { id: true, title: true, dueAt: true, priority: true }
      }),
      prisma.task.findMany({
        where: {
          userId,
          status: { not: "done" },
          dueAt: { gte: now, lte: new Date(now.getTime() + 14 * DAY) }
        },
        orderBy: { dueAt: "asc" },
        select: { id: true, title: true, dueAt: true, priority: true }
      }),
      listBudgets(userId, tz, now),
      listBills(userId, tz, now),
      prisma.transaction.aggregate({
        where: { userId, occurredAt: { gte: month.start, lte: month.end } },
        _sum: { amountCents: true }
      }),
      prisma.incomeSource.count({ where: { userId, active: true } }),
      weekTotalMinutes(userId, tz, now),
      recentHabitDays(userId, tz, 7, now),
      prisma.task.findFirst({
        where: {
          userId,
          status: "todo",
          dueAt: {
            gte: now,
            lte: new Date(now.getTime() + 14 * DAY)
          }
        },
        orderBy: [{ updatedAt: "asc" }],
        select: {
          id: true,
          title: true,
          tinyFirstStep: true,
          updatedAt: true
        }
      })
    ]);

  const todaysEvents: BriefingEventRef[] = todaysEventsRaw.map((e) => ({
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    allDay: e.allDay
  }));
  const todaysTasks: BriefingTaskRef[] = todaysTasksRaw.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.dueAt,
    priority: t.priority
  }));

  const topPriorities: BriefingTaskRef[] = [...weekDeadlinesRaw]
    .sort((a, b) => {
      const aDue = a.dueAt ? a.dueAt.getTime() : Infinity;
      const bDue = b.dueAt ? b.dueAt.getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return priorityWeight(b.priority) - priorityWeight(a.priority);
    })
    .slice(0, 3)
    .map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt, priority: t.priority }));

  const upcoming = bills.filter(
    (b) => b.nextDueAt !== null && b.nextDueAt >= now && b.nextDueAt <= horizon7
  );
  const overBudget = budgets
    .filter((b) => b.percentUsed > 100)
    .map((b) => ({ name: b.name, percentUsed: b.percentUsed }));

  const sumThisMonth = netAggregate._sum.amountCents ?? 0;
  const netMonthCents = incomeCount > 0 ? sumThisMonth : null;

  const sleepAvg = average(last14.map((d) => d.sleepHours));
  const latestMood =
    [...last14].reverse().find((d) => d.mood !== null)?.mood ?? null;

  const exerciseTargetMinutes = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { weeklyExerciseTargetMinutes: true }
    })
    .then((u) => u?.weeklyExerciseTargetMinutes ?? 90);

  const stalest =
    stalestRaw && stalestRaw.tinyFirstStep
      ? { id: stalestRaw.id, title: stalestRaw.title, tinyStep: stalestRaw.tinyFirstStep }
      : null;

  const hasAnyData =
    todaysEvents.length > 0 ||
    todaysTasks.length > 0 ||
    topPriorities.length > 0 ||
    upcoming.length > 0 ||
    overBudget.length > 0 ||
    sleepAvg !== null ||
    weekMinutes > 0 ||
    latestMood !== null ||
    stalest !== null;

  return {
    firstName: firstName ?? "there",
    forDate,
    tz,
    currency,
    todaysEvents,
    todaysTasks,
    topPriorities,
    money: {
      upcomingBills: {
        count: upcoming.length,
        totalCents: upcoming.reduce((s, b) => s + b.amountCents, 0)
      },
      overBudget,
      netMonthCents
    },
    health: {
      sleepAvg7Hours: sleepAvg,
      exerciseWeekMinutes: weekMinutes,
      exerciseTargetMinutes,
      latestMood
    },
    stalest,
    hasAnyData
  };
}
