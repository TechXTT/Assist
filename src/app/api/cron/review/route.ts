import { NextResponse } from "next/server";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/cron/auth";
import { getOrCreateReview } from "@/lib/review/get-or-create";
import { aiReviewRenderer } from "@/lib/review/render-via-ai";
import { reviewWeekForVisit } from "@/lib/review/week";
import { sendEmail } from "@/lib/google/gmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Result = {
  userId: string;
  email: string;
  status: "sent" | "skipped" | "error";
  reason?: string;
};

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: { emailReviewEnabled: true },
    select: {
      id: true,
      email: true,
      timezone: true,
      emailDeliveryHour: true,
      emailReviewWeekday: true,
      lastReviewEmailSentOn: true
    }
  });

  const results: Result[] = [];

  for (const user of users) {
    const tz = user.timezone || env.DEFAULT_TIMEZONE;
    const local = toZonedTime(now, tz);
    const localHour = local.getHours();
    const localWeekday = local.getDay();

    if (localHour !== user.emailDeliveryHour) {
      results.push({ userId: user.id, email: user.email, status: "skipped", reason: "hour-mismatch" });
      continue;
    }
    if (localWeekday !== user.emailReviewWeekday) {
      results.push({ userId: user.id, email: user.email, status: "skipped", reason: "weekday-mismatch" });
      continue;
    }

    const week = reviewWeekForVisit(tz, now);

    if (
      user.lastReviewEmailSentOn &&
      user.lastReviewEmailSentOn.getTime() === week.key.getTime()
    ) {
      results.push({ userId: user.id, email: user.email, status: "skipped", reason: "already-sent" });
      continue;
    }

    try {
      const review = await getOrCreateReview(
        user.id,
        week,
        tz,
        env.DEFAULT_CURRENCY,
        { aiRenderer: aiReviewRenderer }
      );

      const weekLocal = toZonedTime(week.start, tz);
      const subject = `Your weekly review — week of ${format(weekLocal, "MMM d")}`;
      await sendEmail(user.id, {
        to: user.email,
        subject,
        bodyText: review.body
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastReviewEmailSentOn: week.key }
      });

      results.push({ userId: user.id, email: user.email, status: "sent" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      console.error(`[cron/review] send failed for ${user.email}:`, reason);
      results.push({ userId: user.id, email: user.email, status: "error", reason });
    }
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    candidateCount: users.length,
    results
  });
}
