export type Urgency = "future" | "soon" | "near" | "imminent" | "overdue";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function urgencyOf(dueAt: Date | null | undefined, now: Date = new Date()): Urgency {
  if (!dueAt) return "future";
  const diff = dueAt.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff < 2 * DAY) return "imminent";
  if (diff < 5 * DAY) return "near";
  return "soon";
}

// Tailwind class strings, kept here so countdown + cards + dashboard agree on color.
export const urgencyTextClass: Record<Urgency, string> = {
  future: "text-muted-foreground",
  soon: "text-emerald-600 dark:text-emerald-400",
  near: "text-amber-600 dark:text-amber-400",
  imminent: "text-red-600 dark:text-red-400",
  overdue: "text-red-700 dark:text-red-300 font-medium"
};

export const urgencyStripeClass: Record<Urgency, string> = {
  future: "bg-muted",
  soon: "bg-emerald-500/70",
  near: "bg-amber-500/70",
  imminent: "bg-red-500/80",
  overdue: "bg-red-700"
};
