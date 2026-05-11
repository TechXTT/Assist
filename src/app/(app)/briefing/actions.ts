"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getOrCreateBriefing } from "@/lib/briefing/get-or-create";
import { aiBriefingRenderer } from "@/lib/briefing/render-via-ai";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

export async function regenerateBriefingToday() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const currency = env.DEFAULT_CURRENCY;
  // 5-min cooldown enforced inside getOrCreateBriefing.
  await getOrCreateBriefing(session.user.id, new Date(), tz, currency, {
    forceRegen: true,
    aiRenderer: aiBriefingRenderer
  });
  revalidatePath("/briefing");
}
