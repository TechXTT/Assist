import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { nextDueAt } from "@/lib/money/bill-utils";

export type ActiveTaskReminder = {
  kind: "task";
  id: string;
  level: string;
  fireAt: Date;
  task: { id: string; title: string; dueAt: Date | null };
};

export type ActiveBillReminder = {
  kind: "bill";
  id: string;
  level: string;
  fireAt: Date;
  bill: {
    id: string;
    name: string;
    amountCents: number;
    currency: string;
    nextDueAt: Date | null;
  };
};

export type ActiveReminder = ActiveTaskReminder | ActiveBillReminder;

const URGENCY_RANK: Record<string, number> = { final: 0, urgent: 1, firm: 2, gentle: 3 };

/**
 * Active reminders for the user — fired, not dismissed, and (for tasks)
 * for not-done parents. Returns a discriminated union so the banner UI
 * can render task-flavored or bill-flavored copy.
 */
export async function listActiveReminders(
  userId: string,
  now: Date = new Date()
): Promise<ActiveReminder[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;

  const [taskRows, billRows] = await Promise.all([
    prisma.reminder.findMany({
      where: {
        userId,
        sentAt: null,
        fireAt: { lte: now },
        NOT: { taskId: null },
        task: { is: { status: { not: "done" } } }
      },
      include: { task: { select: { id: true, title: true, dueAt: true } } }
    }),
    prisma.reminder.findMany({
      where: {
        userId,
        sentAt: null,
        fireAt: { lte: now },
        NOT: { billId: null }
      },
      include: {
        bill: {
          select: {
            id: true,
            name: true,
            amountCents: true,
            currency: true,
            recurring: true,
            dueDay: true,
            dueDate: true,
            lastPaidAt: true
          }
        }
      }
    })
  ]);

  const tasks: ActiveTaskReminder[] = taskRows
    .filter((r): r is typeof r & { task: NonNullable<typeof r.task> } => r.task !== null)
    .map((r) => ({
      kind: "task",
      id: r.id,
      level: r.level,
      fireAt: r.fireAt,
      task: r.task
    }));

  const bills: ActiveBillReminder[] = billRows
    .filter((r): r is typeof r & { bill: NonNullable<typeof r.bill> } => r.bill !== null)
    .map((r) => ({
      kind: "bill",
      id: r.id,
      level: r.level,
      fireAt: r.fireAt,
      bill: {
        id: r.bill.id,
        name: r.bill.name,
        amountCents: r.bill.amountCents,
        currency: r.bill.currency,
        nextDueAt: nextDueAt(r.bill, tz, now)
      }
    }));

  return [...tasks, ...bills].sort((a, b) => {
    const ra = URGENCY_RANK[a.level] ?? 99;
    const rb = URGENCY_RANK[b.level] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.fireAt.getTime() - b.fireAt.getTime();
  });
}
