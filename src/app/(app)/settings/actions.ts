"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { disconnectGoogle } from "@/lib/google/auth";
import {
  syncCalendar,
  syncSingleCalendar,
  type SyncCounts
} from "@/lib/google/sync";
import {
  NotConnectedError,
  ReauthRequiredError
} from "@/lib/google/errors";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

function revalidate() {
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export type SyncNowResult =
  | { ok: true; counts: SyncCounts }
  | { ok: false; reason: "reauth" | "not_connected" | "failed"; message: string };

export async function syncNowAction(): Promise<SyncNowResult> {
  const session = await requireSession();
  try {
    const counts = await syncCalendar(session.user.id);
    revalidate();
    return { ok: true, counts };
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      revalidate();
      return {
        ok: false,
        reason: "reauth",
        message: "Looks like Google forgot us — quick reconnect?"
      };
    }
    if (err instanceof NotConnectedError) {
      return {
        ok: false,
        reason: "not_connected",
        message: "No Google account connected."
      };
    }
    console.error("[syncNowAction] failed:", err);
    return {
      ok: false,
      reason: "failed",
      message: "Couldn't reach Google right now. Try again in a moment."
    };
  }
}

export async function disconnectGoogleAction() {
  const session = await requireSession();
  await disconnectGoogle(session.user.id);
  revalidate();
}

export type SetCalendarResult =
  | { ok: true; enabled: boolean; summary: string }
  | { ok: false; reason: "reauth" | "failed"; message: string };

/**
 * Toggle a single calendar's sync. Turning OFF wipes its events from the
 * local cache so the dashboard updates immediately. Turning ON also kicks
 * an immediate sync of just that calendar.
 */
export async function setCalendarSyncEnabled(
  calendarId: string,
  enabled: boolean
): Promise<SetCalendarResult> {
  const session = await requireSession();

  const calendar = await prisma.calendar.findFirst({
    where: { id: calendarId, userId: session.user.id },
    select: { id: true, summary: true }
  });
  if (!calendar) throw new Error("Calendar not found.");

  if (!enabled) {
    await prisma.$transaction([
      prisma.calendar.update({
        where: { id: calendar.id },
        data: { syncEnabled: false }
      }),
      prisma.calendarEvent.deleteMany({ where: { calendarId: calendar.id } })
    ]);
    revalidate();
    return { ok: true, enabled: false, summary: calendar.summary };
  }

  await prisma.calendar.update({
    where: { id: calendar.id },
    data: { syncEnabled: true }
  });

  try {
    await syncSingleCalendar(session.user.id, calendar.id);
    revalidate();
    return { ok: true, enabled: true, summary: calendar.summary };
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      revalidate();
      return {
        ok: false,
        reason: "reauth",
        message: "Looks like Google forgot us — quick reconnect?"
      };
    }
    console.error("[setCalendarSyncEnabled] sync failed:", err);
    revalidate();
    return {
      ok: false,
      reason: "failed",
      message: "Couldn't fetch that calendar right now. We'll try again on the next sync."
    };
  }
}

const setAiMonthlyCapSchema = z.object({
  cents: z.number().int().min(0).max(100_00)
});

export async function setAiMonthlyCap(input: z.infer<typeof setAiMonthlyCapSchema>) {
  const session = await requireSession();
  const data = setAiMonthlyCapSchema.parse(input);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { aiMonthlyCapCents: data.cents }
  });
  revalidatePath("/settings");
}
