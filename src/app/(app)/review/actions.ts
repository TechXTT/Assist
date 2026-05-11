"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  getOrCreateReview,
  setReviewTopPriorities
} from "@/lib/review/get-or-create";
import { aiReviewRenderer } from "@/lib/review/render-via-ai";
import { reviewWeekForVisit, weekByIso } from "@/lib/review/week";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

export async function regenerateReviewLatest() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const currency = env.DEFAULT_CURRENCY;
  const week = reviewWeekForVisit(tz, new Date());
  await getOrCreateReview(session.user.id, week, tz, currency, {
    forceRegen: true,
    aiRenderer: aiReviewRenderer
  });
  revalidatePath("/review");
}

const savePicksSchema = z.object({
  weekIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "bad week key"),
  taskIds: z.array(z.string()).max(3)
});

export async function saveTopPriorities(input: z.infer<typeof savePicksSchema>) {
  const session = await requireSession();
  const { weekIso, taskIds } = savePicksSchema.parse(input);
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const week = weekByIso(tz, weekIso);
  if (!week) throw new Error("Couldn't resolve week.");

  // Ensure the review row exists before writing picks.
  await getOrCreateReview(session.user.id, week, tz, env.DEFAULT_CURRENCY);
  await setReviewTopPriorities(session.user.id, week.key, taskIds);

  revalidatePath("/review");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
