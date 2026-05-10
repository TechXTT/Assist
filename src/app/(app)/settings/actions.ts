"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { disconnectGoogle } from "@/lib/google/auth";
import { syncCalendar, type SyncCounts } from "@/lib/google/sync";
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
