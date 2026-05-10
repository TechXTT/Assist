import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { subDays } from "date-fns";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { HEALTH_COPY } from "@/lib/health/copy";
import { listSessions, weekTotalMinutes } from "@/lib/health/exercise-queries";
import { recentHabitDays, todayHabitLog } from "@/lib/health/habit-queries";
import { localDateOnly } from "@/lib/health/sleep";

import { ExerciseSection } from "@/app/(app)/health/_components/exercise/exercise-section";
import { SleepSection } from "@/app/(app)/health/_components/sleep/sleep-section";
import { NutritionSection } from "@/app/(app)/health/_components/nutrition/nutrition-section";
import { MoodSection } from "@/app/(app)/health/_components/mood/mood-section";
import { HealthJumpNav } from "@/app/(app)/health/_components/health-jump-nav";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      timezone: true,
      weeklyExerciseTargetMinutes: true,
      sleepTargetHours: true,
      targetBedtime: true,
      windDownEnabled: true,
      windDownMinutesBefore: true
    }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const now = new Date();
  const todayUtc = localDateOnly(now, tz);

  const [weekMinutes, last14, todayLog, recentSessions] = await Promise.all([
    weekTotalMinutes(userId, tz, now),
    recentHabitDays(userId, tz, 14, now),
    todayHabitLog(userId, tz, now),
    listSessions(userId, { since: subDays(now, 21), take: 50 })
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{HEALTH_COPY.page.title}</h1>
        <p className="text-sm text-muted-foreground">{HEALTH_COPY.page.subtitle}</p>
      </div>

      <HealthJumpNav />

      <ExerciseSection
        recentSessions={recentSessions}
        weekMinutes={weekMinutes}
        weeklyTargetMinutes={user?.weeklyExerciseTargetMinutes ?? 90}
        timezone={tz}
        todayIso={isoDate(todayUtc, tz)}
      />

      <SleepSection
        last14={last14}
        sleepTargetHours={user?.sleepTargetHours ?? null}
        windDown={{
          enabled: user?.windDownEnabled ?? false,
          targetBedtime: user?.targetBedtime ?? null,
          minutesBefore: user?.windDownMinutesBefore ?? 30
        }}
        todayIso={isoDate(todayUtc, tz)}
      />

      <NutritionSection
        today={{
          waterGlasses: todayLog.waterGlasses,
          mealsLogged: todayLog.mealsLogged,
          notes: todayLog.notes
        }}
        last7={last14.slice(-7)}
        todayIso={isoDate(todayUtc, tz)}
      />

      <MoodSection
        last14={last14}
        todayMood={todayLog.mood}
        todayNote={todayLog.notes}
        todayIso={isoDate(todayUtc, tz)}
      />
    </div>
  );
}

function isoDate(utcDay: Date, tz: string): string {
  // Render the user-local "YYYY-MM-DD" for a UTC-midnight Date.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(utcDay);
}
