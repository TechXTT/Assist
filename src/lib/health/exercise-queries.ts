import { endOfWeek, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";

export type ExerciseSessionRow = {
  id: string;
  activity: string;
  minutes: number;
  occurredAt: Date;
  notes: string | null;
};

/**
 * Return the UTC bounds of the user-local week (Mon–Sun) containing `now`.
 */
export function currentWeek(tz: string, now: Date = new Date()): { start: Date; end: Date } {
  const local = toZonedTime(now, tz);
  return {
    start: fromZonedTime(startOfWeek(local, { weekStartsOn: 1 }), tz),
    end: fromZonedTime(endOfWeek(local, { weekStartsOn: 1 }), tz)
  };
}

export async function listSessions(
  userId: string,
  opts: { since?: Date; until?: Date; take?: number } = {}
): Promise<ExerciseSessionRow[]> {
  const rows = await prisma.exerciseSession.findMany({
    where: {
      userId,
      ...(opts.since || opts.until
        ? {
            occurredAt: {
              ...(opts.since ? { gte: opts.since } : {}),
              ...(opts.until ? { lte: opts.until } : {})
            }
          }
        : {})
    },
    orderBy: { occurredAt: "desc" },
    take: opts.take,
    select: {
      id: true,
      activity: true,
      minutes: true,
      occurredAt: true,
      notes: true
    }
  });
  return rows;
}

export async function weekTotalMinutes(
  userId: string,
  tz: string,
  now: Date = new Date()
): Promise<number> {
  const { start, end } = currentWeek(tz, now);
  const agg = await prisma.exerciseSession.aggregate({
    where: { userId, occurredAt: { gte: start, lte: end } },
    _sum: { minutes: true }
  });
  return agg._sum.minutes ?? 0;
}

/**
 * Sum exercise minutes per local day for the given UTC range. Returns a Map
 * keyed by `yyyy-MM-dd` (user local) so callers can derive HabitLog-equivalent
 * totals without storing them.
 */
export async function exerciseMinutesByLocalDay(
  userId: string,
  tz: string,
  start: Date,
  end: Date
): Promise<Map<string, number>> {
  const rows = await prisma.exerciseSession.findMany({
    where: { userId, occurredAt: { gte: start, lte: end } },
    select: { minutes: true, occurredAt: true }
  });
  const map = new Map<string, number>();
  for (const r of rows) {
    const local = toZonedTime(r.occurredAt, tz);
    const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + r.minutes);
  }
  return map;
}
