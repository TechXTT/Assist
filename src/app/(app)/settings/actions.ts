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

const setEmailPrefsSchema = z.object({
  emailBriefingEnabled: z.boolean(),
  emailReviewEnabled: z.boolean(),
  emailDeliveryHour: z.number().int().min(0).max(23),
  emailReviewWeekday: z.number().int().min(0).max(6)
});

export type SetEmailPrefsInput = z.infer<typeof setEmailPrefsSchema>;

export async function setEmailPrefs(input: SetEmailPrefsInput) {
  const session = await requireSession();
  const data = setEmailPrefsSchema.parse(input);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      emailBriefingEnabled: data.emailBriefingEnabled,
      emailReviewEnabled: data.emailReviewEnabled,
      emailDeliveryHour: data.emailDeliveryHour,
      emailReviewWeekday: data.emailReviewWeekday
    }
  });
  revalidatePath("/settings");
}

export type ListInstitutionsResult =
  | {
      ok: true;
      institutions: Array<{
        name: string;
        country: string;
        logo: string | null;
        sandbox: boolean;
      }>;
    }
  | { ok: false; reason: "unavailable" | "failed"; message: string };

export async function listInstitutionsAction(country: string): Promise<ListInstitutionsResult> {
  await requireSession();
  const trimmed = (country || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) {
    return { ok: false, reason: "failed", message: "Country must be a 2-letter ISO code." };
  }
  try {
    const { isBankingAvailable, listAspsps } = await import("@/lib/banking/enablebanking");
    if (!isBankingAvailable()) {
      return {
        ok: false,
        reason: "unavailable",
        message:
          "Set ENABLE_BANKING_APPLICATION_ID and ENABLE_BANKING_PRIVATE_KEY_BASE64 to enable banking."
      };
    }
    const aspsps = await listAspsps({ country: trimmed });
    return {
      ok: true,
      institutions: aspsps.map((a) => ({
        name: a.name,
        country: a.country,
        logo: a.logo ?? null,
        sandbox: a.sandbox ?? false
      }))
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't fetch.";
    return { ok: false, reason: "failed", message };
  }
}

export type SyncBankResult =
  | { ok: true; inserted: number; skippedDuplicates: number; accountsScanned: number; expired: boolean }
  | { ok: false; reason: "unavailable" | "failed"; message: string };

export async function syncBankConnectionAction(connectionId: string): Promise<SyncBankResult> {
  const session = await requireSession();
  const owned = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
    select: { userId: true }
  });
  if (!owned || owned.userId !== session.user.id) {
    return { ok: false, reason: "failed", message: "Connection not found." };
  }
  try {
    const { isBankingAvailable } = await import("@/lib/banking/enablebanking");
    if (!isBankingAvailable()) {
      return { ok: false, reason: "unavailable", message: "Banking not configured." };
    }
    const { syncBankConnection } = await import("@/lib/banking/sync");
    const result = await syncBankConnection(connectionId);
    revalidatePath("/settings");
    revalidatePath("/money");
    return {
      ok: true,
      inserted: result.inserted,
      skippedDuplicates: result.skippedDuplicates,
      accountsScanned: result.accountsScanned,
      expired: result.reason === "expired" || result.reason === "rejected"
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return { ok: false, reason: "failed", message };
  }
}

export async function disconnectBankConnectionAction(
  connectionId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requireSession();
  try {
    const { disconnectBankConnection } = await import("@/lib/banking/sync");
    await disconnectBankConnection(session.user.id, connectionId);
    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Disconnect failed.";
    return { ok: false, message };
  }
}

export type SendTestEmailResult =
  | { ok: true }
  | { ok: false; reason: "reauth" | "not_connected" | "failed"; message: string };

export async function sendTestEmailAction(): Promise<SendTestEmailResult> {
  const session = await requireSession();
  try {
    const { sendEmail } = await import("@/lib/google/gmail");
    await sendEmail(session.user.id, {
      to: session.user.email,
      subject: "Assist test email",
      bodyText:
        "If you're reading this, your Gmail send permission is wired up correctly.\n\n— Assist"
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ReauthRequiredError) {
      return {
        ok: false,
        reason: "reauth",
        message: "Reconnect Google to grant send permission."
      };
    }
    if (err instanceof NotConnectedError) {
      return {
        ok: false,
        reason: "not_connected",
        message: "No Google account connected."
      };
    }
    console.error("[sendTestEmailAction] failed:", err);
    return {
      ok: false,
      reason: "failed",
      message: "Couldn't send right now. Try again in a moment."
    };
  }
}
