import { addDays, startOfDay, subDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  listCalendars,
  listEvents,
  type NormalizedCalendar,
  type NormalizedEvent
} from "@/lib/google/calendar";
import { NotConnectedError, ReauthRequiredError } from "@/lib/google/errors";

export type SyncCounts = {
  added: number;
  updated: number;
  removed: number;
  calendarsSynced: number;
};
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

/**
 * Step A — sync the user's calendar list. Upserts each Google calendar
 * locally; for newly-discovered ones, defaults `syncEnabled` to whatever
 * Google considers "selected" (i.e. visible in Calendar's UI). Existing
 * rows keep their user-chosen `syncEnabled`. Returns local Calendar rows
 * for downstream Step B.
 */
async function syncCalendarList(userId: string, remote: NormalizedCalendar[]) {
  const local = await prisma.calendar.findMany({ where: { userId } });
  const localByGoogleId = new Map(local.map((c) => [c.googleCalendarId, c]));
  const remoteIds = new Set(remote.map((c) => c.googleCalendarId));

  for (const cal of remote) {
    const existing = localByGoogleId.get(cal.googleCalendarId);
    if (!existing) {
      await prisma.calendar.create({
        data: {
          userId,
          googleCalendarId: cal.googleCalendarId,
          summary: cal.summary,
          description: cal.description,
          backgroundColor: cal.backgroundColor,
          foregroundColor: cal.foregroundColor,
          primary: cal.primary,
          syncEnabled: cal.selected,
          accessRole: cal.accessRole
        }
      });
    } else {
      await prisma.calendar.update({
        where: { id: existing.id },
        data: {
          summary: cal.summary,
          description: cal.description,
          backgroundColor: cal.backgroundColor,
          foregroundColor: cal.foregroundColor,
          primary: cal.primary,
          accessRole: cal.accessRole
          // Don't touch syncEnabled — that's the user's choice now.
        }
      });
    }
  }

  // Calendars removed in Google → drop locally (cascade nukes their events).
  const stale = local.filter((c) => !remoteIds.has(c.googleCalendarId));
  if (stale.length > 0) {
    await prisma.calendar.deleteMany({ where: { id: { in: stale.map((c) => c.id) } } });
  }

  return prisma.calendar.findMany({ where: { userId, syncEnabled: true } });
}

/**
 * Step B — sync events for a single local Calendar. Window-based upsert,
 * scoped to that calendar. Returns counts.
 */
async function syncEventsForCalendar(
  userId: string,
  calendar: { id: string; googleCalendarId: string },
  rangeStart: Date,
  rangeEnd: Date,
  now: Date
): Promise<{ added: number; updated: number; removed: number }> {
  const remote = await listEvents(userId, {
    rangeStart,
    rangeEnd,
    calendarId: calendar.googleCalendarId
  });

  const localCache = await prisma.calendarEvent.findMany({
    where: {
      calendarId: calendar.id,
      AND: [{ startsAt: { lt: rangeEnd } }, { endsAt: { gt: rangeStart } }]
    }
  });

  const remoteIds = new Set(remote.map((e) => e.googleEventId));
  const localById = new Map(localCache.map((e) => [e.googleEventId, e]));

  let added = 0;
  let updated = 0;

  for (const event of remote) {
    const local = localById.get(event.googleEventId);
    if (!local) {
      await prisma.calendarEvent.create({
        data: {
          userId,
          calendarId: calendar.id,
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

  return { added, updated, removed: stale.length };
}

export async function syncCalendar(userId: string): Promise<SyncCounts> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user.timezone || env.DEFAULT_TIMEZONE;
  const { rangeStart, rangeEnd } = syncWindow(tz);
  const now = new Date();

  // Step A
  const remoteCalendars = await listCalendars(userId);
  const enabled = await syncCalendarList(userId, remoteCalendars);

  // Step B
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const cal of enabled) {
    const counts = await syncEventsForCalendar(userId, cal, rangeStart, rangeEnd, now);
    added += counts.added;
    updated += counts.updated;
    removed += counts.removed;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { lastCalendarSyncAt: now, googleNeedsReauth: false }
  });

  return { added, updated, removed, calendarsSynced: enabled.length };
}

/**
 * Sync events for one specific calendar without touching the rest. Used by
 * the toggle-on path so the user gets immediate feedback without waiting
 * for the global staleness window.
 */
export async function syncSingleCalendar(
  userId: string,
  calendarId: string
): Promise<{ added: number; updated: number; removed: number }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user.timezone || env.DEFAULT_TIMEZONE;
  const { rangeStart, rangeEnd } = syncWindow(tz);
  const now = new Date();

  const calendar = await prisma.calendar.findFirstOrThrow({
    where: { id: calendarId, userId },
    select: { id: true, googleCalendarId: true }
  });

  return syncEventsForCalendar(userId, calendar, rangeStart, rangeEnd, now);
}

/**
 * Dashboard read-on-demand sync. Never throws — failures degrade gracefully.
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
