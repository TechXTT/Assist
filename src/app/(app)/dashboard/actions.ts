"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";
import { maybeSyncCalendar, type MaybeSyncResult } from "@/lib/google/sync";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

/**
 * Triggered client-side on dashboard mount. Renders the dashboard
 * stale-while-revalidate: cached events render immediately, then this
 * fires and the UI refreshes if anything changed.
 */
export async function syncCalendarInBackground(): Promise<MaybeSyncResult> {
  const session = await requireSession();
  const result = await maybeSyncCalendar(session.user.id);
  if (result === "synced") {
    revalidatePath("/dashboard");
  }
  return result;
}
