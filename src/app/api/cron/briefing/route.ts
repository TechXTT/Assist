import { NextResponse } from "next/server";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/cron/auth";
import {
  getOrCreateBriefing,
  briefingDateKey
} from "@/lib/briefing/get-or-create";
import { aiBriefingRenderer } from "@/lib/briefing/render-via-ai";
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
    where: { emailBriefingEnabled: true },
    select: {
      id: true,
      email: true,
      name: true,
      timezone: true,
      emailDeliveryHour: true,
      lastBriefingEmailSentOn: true
    }
  });

  const results: Result[] = [];

  for (const user of users) {
    const tz = user.timezone || env.DEFAULT_TIMEZONE;
    const local = toZonedTime(now, tz);
    const localHour = local.getHours();
    const todayKey = briefingDateKey(now, tz);

    if (localHour !== user.emailDeliveryHour) {
      results.push({ userId: user.id, email: user.email, status: "skipped", reason: "hour-mismatch" });
      continue;
    }

    if (
      user.lastBriefingEmailSentOn &&
      user.lastBriefingEmailSentOn.getTime() === todayKey.getTime()
    ) {
      results.push({ userId: user.id, email: user.email, status: "skipped", reason: "already-sent" });
      continue;
    }

    try {
      const briefing = await getOrCreateBriefing(
        user.id,
        now,
        tz,
        env.DEFAULT_CURRENCY,
        { aiRenderer: aiBriefingRenderer }
      );

      const subject = `Your morning briefing — ${format(local, "EEE, MMM d")}`;
      await sendEmail(user.id, {
        to: user.email,
        subject,
        bodyText: briefing.body
      });

      await prisma.user.update({
        where: { id: user.id },
        data: { lastBriefingEmailSentOn: todayKey }
      });

      results.push({ userId: user.id, email: user.email, status: "sent" });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown";
      console.error(`[cron/briefing] send failed for ${user.email}:`, reason);
      results.push({ userId: user.id, email: user.email, status: "error", reason });
    }
  }

  return NextResponse.json({
    ranAt: now.toISOString(),
    candidateCount: users.length,
    results
  });
}
