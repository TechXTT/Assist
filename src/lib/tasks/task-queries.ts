import { prisma } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;

export type TaskWithReminders = Awaited<ReturnType<typeof listAllTasks>>[number];

export async function listAllTasks(userId: string) {
  return prisma.task.findMany({
    where: { userId },
    include: {
      reminders: {
        where: { sentAt: null },
        select: { id: true, level: true, fireAt: true }
      }
    },
    orderBy: [
      { status: "asc" }, // todo, doing, done — alphabetical happens to match priority
      { dueAt: "asc" },
      { createdAt: "desc" }
    ]
  });
}

/** Tasks whose dueAt falls within the user's local "today" — server passes the bounds in UTC. */
export async function listTodayTasks(userId: string, dayStartUtc: Date, dayEndUtc: Date) {
  return prisma.task.findMany({
    where: {
      userId,
      status: { not: "done" },
      dueAt: { gte: dayStartUtc, lte: dayEndUtc }
    },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      title: true,
      dueAt: true,
      priority: true,
      status: true,
      tinyFirstStep: true,
      updatedAt: true
    }
  });
}

/** Tasks due in the next 7 days (rolling, including today). */
export async function listWeekDeadlines(userId: string, now: Date = new Date()) {
  const horizon = new Date(now.getTime() + 7 * DAY);
  return prisma.task.findMany({
    where: {
      userId,
      status: { not: "done" },
      dueAt: { gte: now, lte: horizon }
    },
    orderBy: { dueAt: "asc" },
    select: {
      id: true,
      title: true,
      dueAt: true,
      priority: true,
      status: true,
      tinyFirstStep: true,
      updatedAt: true
    }
  });
}
