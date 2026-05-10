"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HEALTH_COPY } from "@/lib/health/copy";
import type { HabitDay } from "@/lib/health/habit-queries";

import { Counter } from "@/app/(app)/health/_components/nutrition/counter";
import { DailyNote } from "@/app/(app)/health/_components/nutrition/daily-note";
import { Past7DaysGrid } from "@/app/(app)/health/_components/nutrition/past-7-days-grid";
import { bumpMeals, bumpWater } from "@/app/(app)/health/actions";

export function NutritionSection({
  today,
  last7,
  todayIso
}: {
  today: { waterGlasses: number; mealsLogged: number; notes: string | null };
  last7: HabitDay[];
  todayIso: string;
}) {
  return (
    <Card id="nutrition" className="scroll-mt-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{HEALTH_COPY.nutrition.heading}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Counter
            label={HEALTH_COPY.nutrition.waterLabel}
            value={today.waterGlasses}
            onBump={(delta) => bumpWater({ delta })}
          />
          <Counter
            label={HEALTH_COPY.nutrition.mealsLabel}
            value={today.mealsLogged}
            onBump={(delta) => bumpMeals({ delta })}
          />
        </div>

        <DailyNote initial={today.notes ?? ""} dateIso={todayIso} />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {HEALTH_COPY.nutrition.past7Heading}
          </p>
          <Past7DaysGrid days={last7} />
        </div>
      </CardContent>
    </Card>
  );
}
