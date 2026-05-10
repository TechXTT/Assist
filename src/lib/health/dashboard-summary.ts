import { prisma } from "@/lib/db";

import {
  currentWeek,
  weekTotalMinutes
} from "@/lib/health/exercise-queries";
import {
  average,
  recentHabitDays,
  type HabitDay
} from "@/lib/health/habit-queries";
import { isInWindDownWindow } from "@/lib/health/sleep";

export type HealthThisWeek = {
  weekStartIso: string;
  exercise: {
    minutes: number;
    targetMinutes: number;
    hasSessions: boolean;
  };
  sleep: {
    avg7Hours: number | null;
    targetHours: number | null;
    nightsLogged7: number;
  };
  mood: {
    points: { dateKey: string; mood: number | null }[]; // last 14 days
    latest: number | null;
    averaged: number | null;
  };
  hasAnyHealthData: boolean;
};

function isoDate(d: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(d);
}

export async function buildHealthThisWeek(
  userId: string,
  tz: string,
  now: Date = new Date()
): Promise<HealthThisWeek> {
  const week = currentWeek(tz, now);
  const [user, weekMinutes, last14] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { weeklyExerciseTargetMinutes: true, sleepTargetHours: true }
    }),
    weekTotalMinutes(userId, tz, now),
    recentHabitDays(userId, tz, 14, now)
  ]);

  const last7 = last14.slice(-7);
  const sleepValues = last7.map((d) => d.sleepHours);
  const nightsLogged7 = sleepValues.filter((v): v is number => typeof v === "number").length;
  const avg7Hours = average(sleepValues);

  const moodPoints = last14.map((d: HabitDay) => ({ dateKey: d.dateKey, mood: d.mood }));
  const moodAvg14 = average(last14.map((d) => d.mood));
  const latestMood = [...last14]
    .reverse()
    .find((d) => d.mood !== null)?.mood ?? null;

  const hasAnyHealthData =
    weekMinutes > 0 ||
    nightsLogged7 > 0 ||
    last14.some((d) => d.mood !== null) ||
    last14.some((d) => d.waterGlasses > 0 || d.mealsLogged > 0);

  return {
    weekStartIso: isoDate(week.start, tz),
    exercise: {
      minutes: weekMinutes,
      targetMinutes: user?.weeklyExerciseTargetMinutes ?? 90,
      hasSessions: weekMinutes > 0
    },
    sleep: {
      avg7Hours,
      targetHours: user?.sleepTargetHours ?? null,
      nightsLogged7
    },
    mood: {
      points: moodPoints,
      latest: latestMood,
      averaged: moodAvg14
    },
    hasAnyHealthData
  };
}

export async function checkWindDown(
  userId: string,
  tz: string,
  now: Date = new Date()
): Promise<number | null> {
  const prefs = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      windDownEnabled: true,
      targetBedtime: true,
      windDownMinutesBefore: true,
      lastWindDownDismissedOn: true
    }
  });
  if (!prefs) return null;
  return isInWindDownWindow(now, tz, {
    enabled: prefs.windDownEnabled,
    targetBedtime: prefs.targetBedtime,
    windDownMinutesBefore: prefs.windDownMinutesBefore,
    lastWindDownDismissedOn: prefs.lastWindDownDismissedOn
  });
}
