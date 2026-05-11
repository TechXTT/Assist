import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  briefingDateKey,
  getOrCreateBriefing,
  getBriefingForDate,
  listBriefingHistory
} from "@/lib/briefing/get-or-create";
import { aiBriefingRenderer } from "@/lib/briefing/render-via-ai";

import { BriefingView } from "@/app/(app)/briefing/_components/briefing-view";

export const dynamic = "force-dynamic";

function parseDateParam(value: string | undefined, tz: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  // Treat YYYY-MM-DD as a local date in user tz, render mid-day to be safe.
  const [y, m, d] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return candidate;
}

export default async function BriefingPage({
  searchParams
}: {
  searchParams: { date?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const currency = env.DEFAULT_CURRENCY;
  const now = new Date();

  const selectedDate = parseDateParam(searchParams.date, tz);
  const todayKey = briefingDateKey(now, tz);
  const selectedKey = briefingDateKey(selectedDate, tz);
  const isToday = todayKey.getTime() === selectedKey.getTime();

  const briefing = isToday
    ? await getOrCreateBriefing(userId, now, tz, currency, {
        aiRenderer: aiBriefingRenderer
      })
    : (await getBriefingForDate(userId, selectedDate, tz)) ?? null;

  const history = await listBriefingHistory(userId, 30);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Daily briefing</h1>
        <p className="text-sm text-muted-foreground">
          A short read on today — schedule, priorities, money, health.
        </p>
      </div>

      <BriefingView
        body={briefing?.body ?? null}
        generatedBy={briefing?.generatedBy ?? null}
        modelUsed={briefing?.modelUsed ?? null}
        generatedAt={briefing?.generatedAt ?? null}
        isToday={isToday}
        forDateLabel={format(toZonedTime(selectedDate, tz), "EEEE, d MMMM yyyy")}
        forDateIso={format(toZonedTime(selectedDate, tz), "yyyy-MM-dd")}
        history={history.map((h) => ({
          dateIso: format(toZonedTime(h.forDate, tz), "yyyy-MM-dd"),
          label: format(toZonedTime(h.forDate, tz), "EEE, d MMM"),
          generatedBy: h.generatedBy
        }))}
      />
    </div>
  );
}
