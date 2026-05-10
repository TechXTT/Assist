import { addMonths, addYears, differenceInDays } from "date-fns";

const DAY = 24 * 60 * 60 * 1000;
export const HINT_SNOOZE_DAYS = 30;

export type BillingCycle = "monthly" | "annual";

/**
 * Advance a subscription's nextChargeAt by one cycle. Used by the
 * "Mark charged" action.
 */
export function advanceCycle(nextChargeAt: Date, cycle: string): Date {
  if (cycle === "annual") return addYears(nextChargeAt, 1);
  return addMonths(nextChargeAt, 1);
}

export type SubscriptionFlags = {
  userMarkedUnused: boolean;
  lastReminderShownAt: Date | null;
};

/**
 * Whether the cancel-hint should currently render. We surface it when the
 * user has marked the subscription unused AND either we've never shown
 * the hint OR enough time has passed since they last snoozed it
 * (HINT_SNOOZE_DAYS, ~one monthly cycle).
 */
export function shouldShowCancelHint(
  sub: SubscriptionFlags,
  now: Date = new Date()
): boolean {
  if (!sub.userMarkedUnused) return false;
  if (!sub.lastReminderShownAt) return true;
  const days = differenceInDays(now, sub.lastReminderShownAt);
  return days >= HINT_SNOOZE_DAYS;
}

export function daysUntilNext(nextChargeAt: Date, now: Date = new Date()): number {
  return Math.round((nextChargeAt.getTime() - now.getTime()) / DAY);
}
