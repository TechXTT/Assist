"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HEALTH_COPY } from "@/lib/health/copy";
import { average, type HabitDay } from "@/lib/health/habit-queries";

import { LogSleepButton } from "@/app/(app)/health/_components/sleep/log-sleep-button";
import { SleepChart } from "@/app/(app)/health/_components/sleep/sleep-chart";
import { SleepTargetEditor } from "@/app/(app)/health/_components/sleep/sleep-target-editor";
import { WindDownControls } from "@/app/(app)/health/_components/sleep/wind-down-controls";

export function SleepSection({
  last14,
  sleepTargetHours,
  windDown,
  todayIso
}: {
  last14: HabitDay[];
  sleepTargetHours: number | null;
  windDown: { enabled: boolean; targetBedtime: string | null; minutesBefore: number };
  todayIso: string;
}) {
  const last7 = useMemo(() => last14.slice(-7), [last14]);
  const avg7 = useMemo(() => average(last7.map((d) => d.sleepHours)), [last7]);
  const hasAny = useMemo(() => last14.some((d) => d.sleepHours !== null), [last14]);

  return (
    <Card id="sleep" className="scroll-mt-20">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-base">{HEALTH_COPY.sleep.heading}</CardTitle>
        <LogSleepButton todayIso={todayIso} />
      </CardHeader>
      <CardContent className="space-y-5">
        {hasAny ? (
          <>
            <p className="text-sm text-muted-foreground">
              {avg7 === null
                ? HEALTH_COPY.sleep.sevenDayAvgEmpty
                : HEALTH_COPY.sleep.sevenDayAvg(avg7)}
            </p>
            <SleepChart days={last14} targetHours={sleepTargetHours} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{HEALTH_COPY.sleep.empty}</p>
        )}

        <SleepTargetEditor sleepTargetHours={sleepTargetHours} />

        <WindDownControls
          enabled={windDown.enabled}
          targetBedtime={windDown.targetBedtime}
          minutesBefore={windDown.minutesBefore}
        />
      </CardContent>
    </Card>
  );
}
