import { addDays, addMinutes, differenceInMinutes, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Derive hours of sleep from "HH:mm" bedtime + "HH:mm" wake-time. If wake is
 * earlier than bedtime, we assume the user crossed midnight (slept into the
 * next day), which is the common case.
 */
export function deriveHoursFromTimes(bedtime: string, wakeTime: string): number {
  const [bH, bM] = bedtime.split(":").map(Number);
  const [wH, wM] = wakeTime.split(":").map(Number);
  if (
    !Number.isFinite(bH) ||
    !Number.isFinite(bM) ||
    !Number.isFinite(wH) ||
    !Number.isFinite(wM)
  ) {
    return 0;
  }
  let bedMin = bH * 60 + bM;
  let wakeMin = wH * 60 + wM;
  if (wakeMin <= bedMin) wakeMin += 24 * 60; // crossed midnight
  const minutes = wakeMin - bedMin;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Return the UTC instant representing the user-local start of day for a
 * given Date. Used as the canonical `HabitLog.date` value.
 */
export function localDateOnly(now: Date, tz: string): Date {
  const local = toZonedTime(now, tz);
  return fromZonedTime(startOfDay(local), tz);
}

/**
 * "yyyy-MM-dd" key for a Date in the user's local tz.
 */
export function localDateKey(d: Date, tz: string): string {
  const local = toZonedTime(d, tz);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

/**
 * Compute today's bedtime window in UTC for `targetBedtime` ("HH:mm") and
 * `minutesBefore`. Returns `[start, end]` where end is the bedtime moment.
 *
 * If the bedtime is past-midnight (e.g. "01:30"), we anchor the window to
 * the upcoming bedtime within the user's local "today" or "early tomorrow"
 * — whichever's next.
 */
export function windDownWindow(
  now: Date,
  tz: string,
  targetBedtime: string,
  minutesBefore: number
): { start: Date; end: Date } {
  const [hh, mm] = targetBedtime.split(":").map(Number);
  const localNow = toZonedTime(now, tz);
  const localToday = startOfDay(localNow);

  // Bedtime moment for "today's evening" — if bedtime is before noon (like
  // 01:30), interpret it as belonging to the next day.
  const beltMinutes = hh * 60 + mm;
  const earlyMorning = beltMinutes < 12 * 60;
  const bedLocal = earlyMorning
    ? addMinutes(addDays(localToday, 1), beltMinutes)
    : addMinutes(localToday, beltMinutes);

  // If we've already passed today's bedtime moment, jump to tomorrow's.
  const localBed = bedLocal < localNow ? addDays(bedLocal, 1) : bedLocal;

  const end = fromZonedTime(localBed, tz);
  const start = addMinutes(end, -minutesBefore);
  return { start, end };
}

/**
 * Returns `null` when the user isn't currently inside the wind-down window
 * (or it's already been dismissed today). Otherwise returns the minutes
 * remaining until target bedtime (rounded down, can be 0).
 */
export function isInWindDownWindow(
  now: Date,
  tz: string,
  prefs: {
    enabled: boolean;
    targetBedtime: string | null;
    windDownMinutesBefore: number;
    lastWindDownDismissedOn: Date | null;
  }
): number | null {
  if (!prefs.enabled || !prefs.targetBedtime) return null;

  const { start, end } = windDownWindow(
    now,
    tz,
    prefs.targetBedtime,
    prefs.windDownMinutesBefore
  );

  if (now < start || now > end) return null;

  if (prefs.lastWindDownDismissedOn) {
    const dismissedKey = localDateKey(prefs.lastWindDownDismissedOn, tz);
    const todayKey = localDateKey(now, tz);
    if (dismissedKey === todayKey) return null;
  }

  return Math.max(0, Math.floor(differenceInMinutes(end, now)));
}
