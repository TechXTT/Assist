"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { HEALTH_COPY } from "@/lib/health/copy";
import { setMood } from "@/app/(app)/health/actions";

export function MoodScale({
  currentScore,
  dateIso
}: {
  currentScore: number | null;
  dateIso: string;
}) {
  const [local, setLocal] = useState<number | null>(currentScore);
  const [pending, startTransition] = useTransition();

  function pick(score: number) {
    const nextScore = local === score ? null : score; // tap again to clear
    setLocal(nextScore);
    startTransition(async () => {
      try {
        await setMood({ date: dateIso, score: nextScore });
        if (nextScore !== null) toast.success(HEALTH_COPY.mood.logToast);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
        setLocal(currentScore);
      }
    });
  }

  return (
    <ul className="flex flex-wrap gap-1.5">
      {HEALTH_COPY.mood.scaleLabels.map((label, idx) => {
        const score = idx + 1;
        const isActive = local === score;
        return (
          <li key={score}>
            <button
              type="button"
              onClick={() => pick(score)}
              disabled={pending}
              aria-pressed={isActive}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
