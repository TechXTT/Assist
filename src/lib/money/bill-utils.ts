import { addMonths, getDaysInMonth, setDate, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type BillForNextDue = {
  recurring: boolean;
  dueDay: number | null;
  dueDate: Date | null;
  lastPaidAt: Date | null;
};

/**
 * Compute the next due date for a bill in the user's timezone.
 *
 * Rules:
 * - One-off (recurring=false): nextDueAt = dueDate, unless already paid
 *   (lastPaidAt >= dueDate) in which case the bill is "done" and we
 *   return null.
 * - Recurring: nextDueAt = dueDay-of-(start of month after lastPaidAt),
 *   or dueDay-of-current-month if never paid. Caps dueDay at month end
 *   (e.g. dueDay=31 in February → 28 or 29).
 *
 * The result may be in the past (overdue) — callers should surface that
 * in the UI rather than skipping past it.
 */
export function nextDueAt(
  bill: BillForNextDue,
  timezone: string,
  now: Date = new Date()
): Date | null {
  if (!bill.recurring) {
    if (!bill.dueDate) return null;
    if (bill.lastPaidAt && bill.lastPaidAt.getTime() >= bill.dueDate.getTime()) return null;
    return bill.dueDate;
  }

  if (!bill.dueDay) return null;

  const localNow = toZonedTime(now, timezone);
  let baseline: Date;
  if (bill.lastPaidAt) {
    const paidLocal = toZonedTime(bill.lastPaidAt, timezone);
    baseline = startOfMonth(addMonths(paidLocal, 1));
  } else {
    baseline = startOfMonth(localNow);
  }

  const day = Math.min(bill.dueDay, getDaysInMonth(baseline));
  const candidate = setDate(baseline, day);
  return fromZonedTime(candidate, timezone);
}
