"use client";

import { cn } from "@/lib/utils";
import { HEALTH_COPY } from "@/lib/health/copy";

export function WeekProgress({
  weekMinutes,
  weeklyTargetMinutes
}: {
  weekMinutes: number;
  weeklyTargetMinutes: number;
}) {
  const target = Math.max(0, weeklyTargetMinutes);
  const hasTarget = target > 0;
  const pct = hasTarget ? Math.min(100, Math.round((weekMinutes / target) * 100)) : 0;

  // Color rule per brief: stone <50%, soft amber at target, stone again >target.
  // i.e. amber only when (hasTarget && weekMinutes >= target).
  const reachedTarget = hasTarget && weekMinutes >= target;
  const barClass = reachedTarget ? "bg-amber-400/70" : "bg-stone-400";

  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barClass)}
          style={{ width: `${hasTarget ? pct : 0}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {hasTarget
          ? HEALTH_COPY.exercise.weekCaption(weekMinutes, target)
          : HEALTH_COPY.exercise.weekCaptionNoTarget(weekMinutes)}
      </p>
    </div>
  );
}
