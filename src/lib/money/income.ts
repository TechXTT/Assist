import { addDays, addMonths, format, getDaysInMonth, setDate, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type Cadence = "monthly" | "biweekly" | "weekly" | "oneoff";

export const CADENCES: Cadence[] = ["monthly", "biweekly", "weekly", "oneoff"];

const ORDINAL_SUFFIX = (day: number): string => {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};

/**
 * Compute the next expected date for an income source after a receipt.
 *
 * Rules (per phase-4h-brief-income.md §4):
 * - monthly + anchorDay: in user tz, if currentDate.day < anchor → this
 *   month's anchor; else next month's anchor. anchorDay is capped at the
 *   target month's last day (Feb 31 → Feb 28/29).
 * - biweekly → currentDate + 14 days.
 * - weekly → currentDate + 7 days.
 * - oneoff → null (caller flips active = false).
 */
export function nextDateForCadence(
  currentDate: Date,
  cadence: string,
  anchorDay: number | null,
  timezone: string
): Date | null {
  if (cadence === "oneoff") return null;
  if (cadence === "weekly") return addDays(currentDate, 7);
  if (cadence === "biweekly") return addDays(currentDate, 14);
  if (cadence === "monthly") {
    if (!anchorDay || anchorDay < 1 || anchorDay > 31) return null;
    const local = toZonedTime(currentDate, timezone);
    const baseline = local.getDate() < anchorDay ? startOfMonth(local) : startOfMonth(addMonths(local, 1));
    const day = Math.min(anchorDay, getDaysInMonth(baseline));
    return fromZonedTime(setDate(baseline, day), timezone);
  }
  return null;
}

/** Render a human label for a cadence + anchor day. */
export function cadenceLabel(
  cadence: string,
  anchorDay: number | null,
  oneoffDate: Date | null = null
): string {
  switch (cadence) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Biweekly";
    case "monthly":
      if (!anchorDay) return "Monthly";
      return `Monthly on the ${anchorDay}${ORDINAL_SUFFIX(anchorDay)}`;
    case "oneoff":
      return oneoffDate ? `One-off on ${format(oneoffDate, "d MMM yyyy")}` : "One-off";
    default:
      return cadence;
  }
}
