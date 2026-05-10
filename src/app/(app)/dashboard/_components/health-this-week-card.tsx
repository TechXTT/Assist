"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Moon, Smile } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HEALTH_COPY } from "@/lib/health/copy";
import type { HealthThisWeek } from "@/lib/health/dashboard-summary";

export function HealthThisWeekCard({ summary }: { summary: HealthThisWeek }) {
  const router = useRouter();

  function navigate() {
    router.push("/health");
  }

  const sleepLine = summary.sleep.avg7Hours
    ? HEALTH_COPY.dashboardCard.sleepLine(summary.sleep.avg7Hours, summary.sleep.targetHours)
    : HEALTH_COPY.dashboardCard.sleepEmpty;

  const exerciseLine = summary.exercise.hasSessions
    ? HEALTH_COPY.dashboardCard.exerciseLine(
        summary.exercise.minutes,
        summary.exercise.targetMinutes
      )
    : HEALTH_COPY.dashboardCard.exerciseEmpty;

  const exercisePct =
    summary.exercise.targetMinutes > 0
      ? Math.min(100, Math.round((summary.exercise.minutes / summary.exercise.targetMinutes) * 100))
      : 0;
  const exerciseReached =
    summary.exercise.targetMinutes > 0 &&
    summary.exercise.minutes >= summary.exercise.targetMinutes;

  const moodData = summary.mood.points.map((p) => ({ mood: p.mood }));
  const hasMood = summary.mood.points.some((p) => p.mood !== null);

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate();
      }}
      className="cursor-pointer transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{HEALTH_COPY.dashboardCard.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!summary.hasAnyHealthData ? (
          <p className="text-sm text-muted-foreground">
            {HEALTH_COPY.dashboardCard.empty}
          </p>
        ) : (
          <>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <Moon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="flex-1">{sleepLine}</span>
              </div>

              <div className="space-y-1 rounded-md px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{exerciseLine}</span>
                </div>
                {summary.exercise.targetMinutes > 0 && (
                  <div className="ml-5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        exerciseReached ? "bg-amber-400/70" : "bg-stone-400"
                      )}
                      style={{ width: `${exercisePct}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
                <Smile className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <div className="flex flex-1 items-center gap-2">
                  {hasMood ? (
                    <>
                      <div className="h-7 w-20 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={moodData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
                            <Line
                              type="monotone"
                              dataKey="mood"
                              stroke="hsl(var(--muted-foreground))"
                              strokeWidth={1.5}
                              dot={false}
                              connectNulls={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {summary.mood.latest !== null && (
                        <span className="text-muted-foreground">
                          {HEALTH_COPY.dashboardCard.moodLatest(summary.mood.latest)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span>{HEALTH_COPY.dashboardCard.moodEmpty}</span>
                  )}
                </div>
              </div>
            </div>

            <Link
              href="/health#mood"
              onClick={(e) => e.stopPropagation()}
              className="block rounded-md border bg-background px-3 py-1.5 text-center text-xs font-medium hover:bg-muted/60"
            >
              {HEALTH_COPY.dashboardCard.logCta}
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}
