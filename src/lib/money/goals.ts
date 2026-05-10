import { differenceInCalendarDays, differenceInCalendarMonths, format } from "date-fns";

import { formatCents } from "@/lib/money/format";

export type GoalForProjection = {
  targetCents: number;
  savedCents: number;
  targetDate: Date | null;
  createdAt: Date;
};

export type Projection =
  | { state: "completed" }
  | { state: "no-rate" } // hasn't saved anything yet
  | { state: "too-early" } // saved something but less than a month elapsed
  | { state: "on-track"; date: Date; copy: string }
  | { state: "behind-target"; date: Date; copy: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Project when a goal will hit its target based on the user's average
 * monthly contribution rate (savedCents / months since createdAt).
 * Tagged result so the UI can render the right copy variant.
 */
export function projectedCompletion(
  goal: GoalForProjection,
  currency: string,
  now: Date = new Date()
): Projection {
  const remaining = goal.targetCents - goal.savedCents;
  if (remaining <= 0) return { state: "completed" };

  if (goal.savedCents <= 0) return { state: "no-rate" };

  const monthsElapsed = differenceInCalendarMonths(now, goal.createdAt);
  if (monthsElapsed < 1) return { state: "too-early" };

  const monthlyRate = goal.savedCents / monthsElapsed;
  if (monthlyRate <= 0) return { state: "no-rate" };

  const monthsRemaining = remaining / monthlyRate;
  const projected = new Date(now.getTime() + monthsRemaining * 30 * DAY_MS);
  const projectedLabel = format(projected, "MMMM yyyy");

  // Round the monthly rate to a friendly multiple of 10 currency units
  // for the casual copy.
  const friendlyMonthlyCents = Math.max(100, Math.round(monthlyRate / 1000) * 1000);
  const monthlyDisplay = formatCents(friendlyMonthlyCents, currency);

  if (goal.targetDate && projected > goal.targetDate) {
    return {
      state: "behind-target",
      date: projected,
      copy: `At your current pace, this lands in ${format(projected, "MMMM")} — past your ${format(goal.targetDate, "MMMM")} target. No drama, just a heads-up.`
    };
  }

  return {
    state: "on-track",
    date: projected,
    copy: `On track for ${projectedLabel} — about ${monthlyDisplay} a month does it.`
  };
}

export function progressPct(goal: { savedCents: number; targetCents: number }): number {
  if (goal.targetCents <= 0) return 0;
  return Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 100));
}

export function daysUntilTarget(targetDate: Date, now: Date = new Date()): number {
  return differenceInCalendarDays(targetDate, now);
}
