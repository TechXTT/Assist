"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  setSubscriptionUnused,
  snoozeCancelHint
} from "@/app/(app)/money/actions";

export function CancelHint({ subId, name }: { subId: string; name: string }) {
  const [pending, start] = useTransition();

  function snooze() {
    start(async () => {
      try {
        await snoozeCancelHint(subId);
        toast.success("Hint snoozed for a month.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't snooze.");
      }
    });
  }

  function clearUnused() {
    start(async () => {
      try {
        await setSubscriptionUnused(subId, false);
        toast.success("Got it — keeping it around.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  return (
    <div className="rounded-md border border-stone-300/60 bg-stone-50 px-3 py-2 text-xs text-stone-800 dark:border-stone-700/40 dark:bg-stone-900/40 dark:text-stone-100">
      <p className="leading-snug">
        Consider canceling? You marked <span className="font-medium">{name}</span> as unused.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={snooze} disabled={pending}>
          Yeah, I&apos;ll cancel
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={clearUnused} disabled={pending}>
          I do use it
        </Button>
      </div>
    </div>
  );
}
