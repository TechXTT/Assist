import { prisma } from "@/lib/db";

import { nextDueAt, type BillForNextDue } from "@/lib/money/bill-utils";

export type BillRow = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  category: string | null;
  recurring: boolean;
  dueDay: number | null;
  dueDate: Date | null;
  lastPaidAt: Date | null;
  reminderEnabled: boolean;
  notes: string | null;
  nextDueAt: Date | null;
};

/**
 * Active bills for the user — recurring bills always show; one-off bills
 * disappear once marked paid. Sorted by computed nextDueAt asc; bills
 * without a next due (paid one-offs) sink to the bottom.
 */
export async function listBills(
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<BillRow[]> {
  const rows = await prisma.bill.findMany({
    where: {
      userId,
      OR: [{ recurring: true }, { lastPaidAt: null }]
    },
    select: {
      id: true,
      name: true,
      amountCents: true,
      currency: true,
      category: true,
      recurring: true,
      dueDay: true,
      dueDate: true,
      lastPaidAt: true,
      reminderEnabled: true,
      notes: true
    }
  });

  return rows
    .map<BillRow>((b) => ({
      ...b,
      nextDueAt: nextDueAt(b as BillForNextDue, timezone, now)
    }))
    .sort((a, b) => {
      if (!a.nextDueAt && !b.nextDueAt) return a.name.localeCompare(b.name);
      if (!a.nextDueAt) return 1;
      if (!b.nextDueAt) return -1;
      return a.nextDueAt.getTime() - b.nextDueAt.getTime();
    });
}
