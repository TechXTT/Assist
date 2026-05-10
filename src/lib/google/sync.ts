import { addDays, startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listEvents, type NormalizedEvent } from "@/lib/google/calendar";
import { NotConnectedError, ReauthRequiredError } from "@/lib/google/errors";

export type SyncCounts = { added: number; updated: number; removed: number };
export type MaybeSyncResult = "fresh" | "synced" | "reauth" | "failed" | "not_connected";

function syncWindow(timezone: string, now: Date = new Date()) {
  const localNow = toZonedTime(now, timezone);
  const localStart = startOfDay(localNow);
  return {
    rangeStart: fromZonedTime(subDays(localStart, 1), timezone),
    rangeEnd: fromZonedTime(addDays(localStart, 30), timezone)
  };
}

function eventsDiffer(
  local: {
    title: string;
    startsAt: Date;
    endsAt: Date;
    location: string | null;
    description: string | null;
    allDay: boolean;
    htmlLink: string | null;
    status: string;
    timeZone: string | null;
  },
  remote: NormalizedEvent
) {
  return (
    local.title !== remote.title ||
    local.startsAt.getTime() !== remote.startsAt.getTime() ||
    local.endsAt.getTime() !== remote.endsAt.getTime() ||
    (local.location ?? null) !== remote.location ||
    (local.description ?? null) !== remote.description ||
    local.allDay !== remote.allDay ||
    (local.htmlLink ?? null) !== remote.htmlLink ||
    local.status !== remote.status ||
    (local.timeZone ?? null) !== remote.timeZone
  );
}

export async function syncCalendar(userId: string): Promise<SyncCounts> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user.timezone || env.DEFAULT_TIMEZONE;
  const { rangeStart, rangeEnd } = syncWindow(tz);

  const remote = await listEvents(userId, { rangeStart, rangeEnd });
  const localCache = await prisma.calendarEvent.findMany({
    where: {
      userId,
      AND: [{ startsAt: { lt: rangeEnd } }, { endsAt: { gt: rangeStart } }]
    }
  });

  const remoteIds = new Set(remote.map((e) => e.googleEventId));
  const localById = new Map(localCache.map((e) => [e.googleEventId, e]));
  const now = new Date();

  let added = 0;
  let updated = 0;

  for (const event of remote) {
    const local = localById.get(event.googleEventId);
    if (!local) {
      await prisma.calendarEvent.create({
        data: {
          userId,
          googleEventId: event.googleEventId,
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location,
          description: event.description,
          allDay: event.allDay,
          htmlLink: event.htmlLink,
          status: event.status,
          timeZone: event.timeZone,
          lastSyncedAt: now
        }
      });
      added++;
    } else if (eventsDiffer(local, event)) {
      await prisma.calendarEvent.update({
        where: { id: local.id },
        data: {
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.location,
          description: event.description,
          allDay: event.allDay,
          htmlLink: event.htmlLink,
          status: event.status,
          timeZone: event.timeZone,
          lastSyncedAt: now
        }
      });
      updated++;
    } else {
      await prisma.calendarEvent.update({
        where: { id: local.id },
        data: { lastSyncedAt: now }
      });
    }
  }

  const stale = localCache.filter((e) => !remoteIds.has(e.googleEventId));
  if (stale.length > 0) {
    await prisma.calendarEvent.deleteMany({
      where: { id: { in: stale.map((e) => e.id) } }
    });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastCalendarSyncAt: now, googleNeedsReauth: false }
  });

  return { added, updated, removed: stale.length };
}

/**
 * Used by the dashboard server component on every page load. Returns a
 * status the page can branch on. Never throws — failures degrade gracefully.
 */
export async function maybeSyncCalendar(userId: string): Promise<MaybeSyncResult> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lastCalendarSyncAt: true, googleNeedsReauth: true }
  });

  if (user.googleNeedsReauth) return "reauth";

  const stalenessMs = env.CALENDAR_SYNC_STALENESS_MINUTES * 60_000;
  if (
    user.lastCalendarSyncAt &&
    Date.now() - user.lastCalendarSyncAt.getTime() < stalenessMs
  ) {
    return "fresh";
  }

  try {
    await syncCalendar(userId);
    return "synced";
  } catch (err) {
    if (err instanceof ReauthRequiredError) return "reauth";
    if (err instanceof NotConnectedError) return "not_connected";
    console.error("[calendar] sync failed:", err);
    return "failed";
  }
}
