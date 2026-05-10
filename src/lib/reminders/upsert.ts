import { prisma } from "@/lib/db";

export type ReminderKind = "task" | "bill";

export type ReminderLevel = "gentle" | "firm" | "urgent" | "final";

export const REMINDER_LEVELS: ReminderLevel[] = ["gentle", "firm", "urgent", "final"];

/**
 * Upsert a single reminder row, parameterized by kind so tasks and bills
 * share the same primitive. Idempotent: if a reminder for the same
 * (entity, level) exists, its fireAt is updated and sentAt is cleared
 * (so a moved deadline re-surfaces a dismissed reminder).
 */
export async function upsertReminder(input: {
  kind: ReminderKind;
  entityId: string;
  userId: string;
  fireAt: Date;
  level: ReminderLevel;
}) {
  const { kind, entityId, userId, fireAt, level } = input;
  const where = kind === "task" ? { taskId: entityId, level } : { billId: entityId, level };

  const existing = await prisma.reminder.findFirst({
    where,
    select: { id: true }
  });

  if (existing) {
    await prisma.reminder.update({
      where: { id: existing.id },
      data: { fireAt, sentAt: null }
    });
    return;
  }

  await prisma.reminder.create({
    data: {
      userId,
      ...(kind === "task" ? { taskId: entityId } : { billId: entityId }),
      level,
      fireAt
    }
  });
}
