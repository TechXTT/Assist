import { addDays, subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { localDateKey, localDateOnly } from "@/lib/health/sleep";

export type HabitDay = {
  dateKey: string; // yyyy-MM-dd local
  date: Date; // UTC instant of user-local midnight
  sleepHours: number | null;
  exerciseMinutes: number; // derived elsewhere; kept for type symmetry
  waterGlasses: number;
  mealsLogged: number;
  mood: number | null;
  notes: string | null;
};

/**
 * Return `count` consecutive user-local days ending today (inclusive).
 * Rows are ordered chronologically (oldest → newest). Missing days are
 * filled with empty stubs.
 */
export async function recentHabitDays(
  userId: string,
  tz: string,
  count: number,
  now: Date = new Date()
): Promise<HabitDay[]> {
  const todayLocal = localDateOnly(now, tz);
  const startLocal = localDateOnly(subDays(now, count - 1), tz);

  const rows = await prisma.habitLog.findMany({
    where: {
      userId,
      date: { gte: startLocal, lte: todayLocal }
    },
    select: {
      date: true,
      sleepHours: true,
      waterGlasses: true,
      mealsLogged: true,
      mood: true,
      notes: true
    }
  });

  const byKey = new Map<string, (typeof rows)[number]>();
  for (const r of rows) byKey.set(localDateKey(r.date, tz), r);

  const out: HabitDay[] = [];
  for (let i = 0; i < count; i++) {
    const dayUtc = localDateOnly(addDays(startLocal, i), tz);
    const key = localDateKey(dayUtc, tz);
    const row = byKey.get(key);
    out.push({
      dateKey: key,
      date: dayUtc,
      sleepHours: row?.sleepHours ?? null,
      exerciseMinutes: 0,
      waterGlasses: row?.waterGlasses ?? 0,
      mealsLogged: row?.mealsLogged ?? 0,
      mood: row?.mood ?? null,
      notes: row?.notes ?? null
    });
  }
  return out;
}

export async function todayHabitLog(userId: string, tz: string, now: Date = new Date()) {
  const dateUtc = localDateOnly(now, tz);
  const row = await prisma.habitLog.findUnique({
    where: { userId_date: { userId, date: dateUtc } },
    select: {
      sleepHours: true,
      waterGlasses: true,
      mealsLogged: true,
      mood: true,
      notes: true
    }
  });
  return {
    date: dateUtc,
    sleepHours: row?.sleepHours ?? null,
    waterGlasses: row?.waterGlasses ?? 0,
    mealsLogged: row?.mealsLogged ?? 0,
    mood: row?.mood ?? null,
    notes: row?.notes ?? null
  };
}

export function average(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
