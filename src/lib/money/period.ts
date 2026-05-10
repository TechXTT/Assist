import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type Range = { start: Date; end: Date };

function localNow(timezone: string, now: Date = new Date()) {
  return toZonedTime(now, timezone);
}

export function currentMonth(timezone: string, now: Date = new Date()): Range {
  const local = localNow(timezone, now);
  return {
    start: fromZonedTime(startOfMonth(local), timezone),
    end: fromZonedTime(endOfMonth(local), timezone)
  };
}

export function lastMonth(timezone: string, now: Date = new Date()): Range {
  const local = subMonths(localNow(timezone, now), 1);
  return {
    start: fromZonedTime(startOfMonth(local), timezone),
    end: fromZonedTime(endOfMonth(local), timezone)
  };
}

/**
 * Convert a date-only string ("YYYY-MM-DD") into a UTC Date that represents
 * the requested local-day boundary in the user's timezone.
 */
export function customRange(
  fromIso: string,
  toIso: string,
  timezone: string
): Range | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso)) return null;
  const start = fromZonedTime(`${fromIso}T00:00:00`, timezone);
  const end = fromZonedTime(`${toIso}T23:59:59.999`, timezone);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (start > end) return null;
  return { start, end };
}

export function daysRemainingInMonth(timezone: string, now: Date = new Date()): number {
  const local = localNow(timezone, now);
  const monthEndUtc = fromZonedTime(endOfMonth(local), timezone);
  const diffMs = monthEndUtc.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
