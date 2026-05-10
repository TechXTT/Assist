import { prisma } from "@/lib/db";

import { upsertReminder } from "@/lib/reminders/upsert";

const DAY = 24 * 60 * 60 * 1000;
const BILL_LEAD_TIME_MS = 3 * DAY;

/**
 * Upsert the firm-level reminder for a bill, set 3 days before its next
 * due date. Idempotent.
 */
export async function upsertReminderForBill(
  billId: string,
  userId: string,
  nextDueAt: Date
) {
  await upsertReminder({
    kind: "bill",
    entityId: billId,
    userId,
    fireAt: new Date(nextDueAt.getTime() - BILL_LEAD_TIME_MS),
    level: "firm"
  });
}

/** Delete all reminder rows for a bill (used on delete or mark-paid). */
export async function deleteRemindersForBill(billId: string) {
  await prisma.reminder.deleteMany({ where: { billId } });
}
