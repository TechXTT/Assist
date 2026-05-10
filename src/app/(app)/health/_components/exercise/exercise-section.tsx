"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HEALTH_COPY } from "@/lib/health/copy";
import type { ExerciseSessionRow } from "@/lib/health/exercise-queries";

import { AddSessionButton } from "@/app/(app)/health/_components/exercise/add-session-button";
import { SessionList } from "@/app/(app)/health/_components/exercise/session-list";
import { WeekProgress } from "@/app/(app)/health/_components/exercise/week-progress";
import { TargetEditor } from "@/app/(app)/health/_components/exercise/target-editor";

export function ExerciseSection({
  recentSessions,
  weekMinutes,
  weeklyTargetMinutes,
  timezone,
  todayIso
}: {
  recentSessions: ExerciseSessionRow[];
  weekMinutes: number;
  weeklyTargetMinutes: number;
  timezone: string;
  todayIso: string;
}) {
  const hasSessions = useMemo(() => recentSessions.length > 0, [recentSessions]);

  return (
    <Card id="exercise" className="scroll-mt-20">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{HEALTH_COPY.exercise.heading}</CardTitle>
        <AddSessionButton todayIso={todayIso} />
      </CardHeader>
      <CardContent className="space-y-5">
        <WeekProgress
          weekMinutes={weekMinutes}
          weeklyTargetMinutes={weeklyTargetMinutes}
        />

        <TargetEditor weeklyTargetMinutes={weeklyTargetMinutes} />

        {hasSessions ? (
          <SessionList sessions={recentSessions} timezone={timezone} />
        ) : (
          <p className="text-sm text-muted-foreground">{HEALTH_COPY.exercise.empty}</p>
        )}
      </CardContent>
    </Card>
  );
}
