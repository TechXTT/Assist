import { addDays, endOfWeek, startOfWeek, subWeeks } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export type Week = {
  /** Monday 00:00:00 in user tz, as the UTC instant. */
  start: Date;
  /** Sunday 23:59:59.999 in user tz, as the UTC instant. */
  end: Date;
  /** Same as `start` but used as the row key. */
  key: Date;
};

export function weekForDate(tz: string, anchor: Date): Week {
  const local = toZonedTime(anchor, tz);
  const startLocal = startOfWeek(local, { weekStartsOn: 1 });
  const endLocal = endOfWeek(local, { weekStartsOn: 1 });
  const start = fromZonedTime(startLocal, tz);
  return {
    start,
    end: fromZonedTime(endLocal, tz),
    key: start
  };
}

export function previousWeek(tz: string, anchor: Date): Week {
  return weekForDate(tz, fromZonedTime(subWeeks(toZonedTime(anchor, tz), 1), tz));
}

/**
 * Pick the week the user should see on /review:
 *   - if anchor is past Sunday-evening of its own week → the current week
 *   - else → last completed week
 *
 * "Sunday evening" = Sun 18:00 in user-local time, per brief §6.
 */
export function reviewWeekForVisit(tz: string, anchor: Date = new Date()): Week {
  const local = toZonedTime(anchor, tz);
  const isSunday = local.getDay() === 0;
  const isSundayEvening = isSunday && local.getHours() >= 18;
  if (isSundayEvening) return weekForDate(tz, anchor);
  return previousWeek(tz, anchor);
}

export function weekStartIso(tz: string, week: Week): string {
  const local = toZonedTime(week.start, tz);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export function weekByIso(tz: string, iso: string): Week | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const local = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return weekForDate(tz, fromZonedTime(toZonedTime(local, tz), tz));
}

/** Earliest week the user has had data; used to bound history lookback. */
export function lastNWeeks(tz: string, anchor: Date, n: number): Week[] {
  const out: Week[] = [];
  let cursor = weekForDate(tz, anchor);
  for (let i = 0; i < n; i++) {
    out.push(cursor);
    cursor = weekForDate(tz, fromZonedTime(addDays(toZonedTime(cursor.start, tz), -1), tz));
  }
  return out;
}
