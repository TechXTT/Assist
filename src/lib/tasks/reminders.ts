import { prisma } from "@/lib/db";

export type ReminderLevel = "gentle" | "firm" | "urgent" | "final";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const OFFSETS: Record<ReminderLevel, number> = {
  gentle: 7 * DAY,
  firm: 2 * DAY,
  urgent: 12 * HOUR,
  final: 1 * HOUR
};

export const REMINDER_LEVELS: ReminderLevel[] = ["gentle", "firm", "urgent", "final"];

/**
 * Upsert the four reminder rows for a task with a dueAt.
 * Idempotent — safe to call on every create/update of a task that has a dueAt.
 * Resets `sentAt` so a moved deadline re-surfaces dismissed reminders.
 */
export async function upsertRemindersForTask(taskId: string, userId: string, dueAt: Date) {
  const existing = await prisma.reminder.findMany({
    where: { taskId, level: { in: REMINDER_LEVELS } },
    select: { id: true, level: true }
  });
  const byLevel = new Map(existing.map((r) => [r.level as ReminderLevel, r.id]));

  await Promise.all(
    REMINDER_LEVELS.map(async (level) => {
      const fireAt = new Date(dueAt.getTime() - OFFSETS[level]);
      const id = byLevel.get(level);
      if (id) {
        await prisma.reminder.update({
          where: { id },
          data: { fireAt, sentAt: null }
        });
      } else {
        await prisma.reminder.create({
          data: { taskId, userId, level, fireAt }
        });
      }
    })
  );
}

/** Delete all reminder rows for a task (used on task delete or completion). */
export async function deleteRemindersForTask(taskId: string) {
  await prisma.reminder.deleteMany({ where: { taskId } });
}

export type ActiveReminder = {
  id: string;
  level: string;
  fireAt: Date;
  sentAt: Date | null;
  task: { id: string; title: string; dueAt: Date | null };
};

/**
 * Active reminders for a user — fired, not dismissed, parent task not done.
 * Sorted by urgency (final > urgent > firm > gentle) then by fireAt asc.
 */
export async function listActiveReminders(
  userId: string,
  now: Date = new Date()
): Promise<ActiveReminder[]> {
  const rows = await prisma.reminder.findMany({
    where: {
      userId,
      sentAt: null,
      fireAt: { lte: now },
      task: { is: { status: { not: "done" } } }
    },
    include: { task: { select: { id: true, title: true, dueAt: true } } },
    orderBy: { fireAt: "asc" }
  });

  const order: Record<string, number> = { final: 0, urgent: 1, firm: 2, gentle: 3 };
  return rows
    .filter((r): r is typeof r & { task: NonNullable<typeof r.task> } => r.task !== null)
    .sort((a, b) => {
      const oa = order[a.level] ?? 99;
      const ob = order[b.level] ?? 99;
      if (oa !== ob) return oa - ob;
      return a.fireAt.getTime() - b.fireAt.getTime();
    });
}
