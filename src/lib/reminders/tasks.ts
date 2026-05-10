import { prisma } from "@/lib/db";

import { REMINDER_LEVELS, upsertReminder, type ReminderLevel } from "@/lib/reminders/upsert";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const OFFSETS: Record<ReminderLevel, number> = {
  gentle: 7 * DAY,
  firm: 2 * DAY,
  urgent: 12 * HOUR,
  final: 1 * HOUR
};

/**
 * Upsert the four reminder rows for a task with a dueAt. Safe to call on
 * every create/update of a task that has a dueAt.
 */
export async function upsertRemindersForTask(taskId: string, userId: string, dueAt: Date) {
  await Promise.all(
    REMINDER_LEVELS.map((level) =>
      upsertReminder({
        kind: "task",
        entityId: taskId,
        userId,
        fireAt: new Date(dueAt.getTime() - OFFSETS[level]),
        level
      })
    )
  );
}

/** Delete all reminder rows for a task (used on task delete or completion). */
export async function deleteRemindersForTask(taskId: string) {
  await prisma.reminder.deleteMany({ where: { taskId } });
}
