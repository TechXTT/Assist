"use client";

import { useState, useTransition } from "react";
import { Moon, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HEALTH_COPY } from "@/lib/health/copy";
import { dismissWindDown } from "@/app/(app)/health/actions";

export function WindDownBanner({ minutesRemaining }: { minutesRemaining: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (dismissed) return null;

  function onDismiss() {
    setDismissed(true);
    startTransition(async () => {
      try {
        await dismissWindDown();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't dismiss.");
        setDismissed(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-stone-300/60 bg-stone-50 px-3 py-2 text-sm text-stone-800 dark:border-stone-700/40 dark:bg-stone-900/40 dark:text-stone-100">
      <Moon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex-1">{HEALTH_COPY.sleep.bannerCopy(minutesRemaining)}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={onDismiss}
        disabled={pending}
      >
        <X className="mr-1 h-3 w-3" aria-hidden />
        {HEALTH_COPY.sleep.bannerDismiss}
      </Button>
    </div>
  );
}
