import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { endOfDay, startOfDay } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listTodayTasks, listWeekDeadlines } from "@/lib/tasks/task-queries";
import { populateTinyFirstSteps } from "@/lib/tasks/tiny-first-step";
import { listActiveReminders } from "@/lib/tasks/reminders";
import { maybeSyncCalendar } from "@/lib/google/sync";
import { ReminderBanners } from "@/components/reminder-banners";
import { PlaceholderCard } from "@/components/placeholder-card";
import {
  TodayCard,
  type TodayItem
} from "@/app/(app)/dashboard/_components/today-card";
import { DeadlinesCard } from "@/app/(app)/dashboard/_components/deadlines-card";
import { ReauthBanner } from "@/app/(app)/dashboard/_components/reauth-banner";

export const dynamic = "force-dynamic";

function todayBoundsUtc(timezone: string) {
  const now = new Date();
  const localNow = toZonedTime(now, timezone);
  return {
    start: fromZonedTime(startOfDay(localNow), timezone),
    end: fromZonedTime(endOfDay(localNow), timezone)
  };
}

function sortKey(item: TodayItem): number {
  if (item.kind === "task") return item.dueAt.getTime();
  // All-day events sort to the very top of the day.
  if (item.allDay) return -Infinity;
  return item.startsAt.getTime();
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const firstName = (user?.name ?? session.user.name)?.split(" ")[0] ?? "there";

  const { start, end } = todayBoundsUtc(tz);

  // Trigger sync first (read-on-demand). Branches the rest of the render.
  const syncResult = await maybeSyncCalendar(userId);

  const [todayTasks, weekTasks, activeReminders, todayEvents] = await Promise.all([
    listTodayTasks(userId, start, end),
    listWeekDeadlines(userId),
    listActiveReminders(userId),
    prisma.calendarEvent.findMany({
      where: {
        userId,
        status: { not: "cancelled" },
        startsAt: { lt: end },
        endsAt: { gt: start }
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        location: true,
        htmlLink: true
      }
    })
  ]);

  const tinyMap = await populateTinyFirstSteps(
    weekTasks.map((t) => ({
      id: t.id,
      status: t.status,
      dueAt: t.dueAt,
      updatedAt: t.updatedAt,
      tinyFirstStep: t.tinyFirstStep
    }))
  );

  const todayItems: TodayItem[] = [
    ...todayTasks.map<TodayItem>((t) => ({
      kind: "task",
      id: t.id,
      title: t.title,
      dueAt: t.dueAt!,
      priority: t.priority
    })),
    ...todayEvents.map<TodayItem>((e) => ({
      kind: "event",
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      allDay: e.allDay,
      location: e.location,
      htmlLink: e.htmlLink
    }))
  ].sort((a, b) => sortKey(a) - sortKey(b));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Hey {firstName} 👋</h1>
        <p className="text-sm text-muted-foreground">Here's what's on your plate.</p>
      </div>

      {syncResult === "reauth" && <ReauthBanner />}

      {syncResult === "failed" && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Couldn't reach Google right now — showing the latest cached events.
        </p>
      )}

      <ReminderBanners
        reminders={activeReminders.map((r) => ({
          id: r.id,
          level: r.level,
          fireAt: r.fireAt,
          task: { id: r.task.id, title: r.task.title, dueAt: r.task.dueAt }
        }))}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TodayCard items={todayItems} />
        <DeadlinesCard
          items={weekTasks
            .filter((t): t is typeof t & { dueAt: Date } => t.dueAt !== null)
            .map((t) => ({
              id: t.id,
              title: t.title,
              dueAt: t.dueAt,
              priority: t.priority,
              tinyFirstStep: tinyMap.get(t.id) ?? null
            }))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PlaceholderCard
          title="Money this month"
          description="Spending vs. budget, top categories, upcoming bills. Lands in Phase 4."
        />
        <PlaceholderCard
          title="Health this week"
          description="Sleep average, exercise minutes, and a mood mini-trendline. Lands in Phase 5."
        />
      </div>
    </div>
  );
}
