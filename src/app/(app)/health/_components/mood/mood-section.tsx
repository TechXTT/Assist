"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HEALTH_COPY } from "@/lib/health/copy";
import { average, type HabitDay } from "@/lib/health/habit-queries";

import { MoodScale } from "@/app/(app)/health/_components/mood/mood-scale";

const MoodTrendline = dynamic(
  () =>
    import("@/app/(app)/health/_components/mood/mood-trendline").then(
      (m) => m.MoodTrendline
    ),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> }
);

export function MoodSection({
  last14,
  todayMood,
  todayNote,
  todayIso
}: {
  last14: HabitDay[];
  todayMood: number | null;
  todayNote: string | null;
  todayIso: string;
}) {
  const avg = useMemo(() => average(last14.map((d) => d.mood)), [last14]);
  const hasAny = useMemo(() => last14.some((d) => d.mood !== null), [last14]);

  return (
    <Card id="mood" className="scroll-mt-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{HEALTH_COPY.mood.heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {HEALTH_COPY.mood.todayPrompt}
          </p>
          <MoodScale currentScore={todayMood} dateIso={todayIso} />
        </div>

        <div className="rounded-md border bg-muted/10 px-3 py-2 text-xs">
          <p className="font-medium text-muted-foreground">
            {HEALTH_COPY.mood.noteFromNutrition}{" "}
            <a
              href="#nutrition"
              className="font-normal underline-offset-2 hover:underline"
            >
              {HEALTH_COPY.mood.noteEditLink}
            </a>
          </p>
          <p className="mt-1 text-sm">
            {todayNote && todayNote.trim()
              ? todayNote
              : <span className="text-muted-foreground">{HEALTH_COPY.mood.noteEmpty}</span>}
          </p>
        </div>

        <div className="space-y-2">
          {hasAny ? (
            <>
              <MoodTrendline days={last14} />
              <p className="text-xs text-muted-foreground">
                {avg === null
                  ? HEALTH_COPY.mood.averageEmpty
                  : HEALTH_COPY.mood.average(avg)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {HEALTH_COPY.mood.trendlineEmpty}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
