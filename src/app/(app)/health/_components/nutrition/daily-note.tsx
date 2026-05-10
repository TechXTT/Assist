"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Textarea } from "@/components/ui/textarea";
import { HEALTH_COPY } from "@/lib/health/copy";
import { setDailyNote } from "@/app/(app)/health/actions";

const SAVE_DEBOUNCE_MS = 600;

export function DailyNote({ initial, dateIso }: { initial: string; dateIso: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const text = value;
      startTransition(async () => {
        try {
          await setDailyNote({ date: dateIso, text });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Couldn't save note.");
        }
      });
      dirtyRef.current = false;
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, dateIso]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground" htmlFor="daily-note">
        {HEALTH_COPY.nutrition.noteLabel}
      </label>
      <Textarea
        id="daily-note"
        rows={2}
        placeholder={HEALTH_COPY.nutrition.notePlaceholder}
        value={value}
        onChange={(e) => {
          dirtyRef.current = true;
          setValue(e.target.value);
        }}
      />
      <p className="text-xs text-muted-foreground">
        {pending ? "Saving…" : "Saves automatically."}
      </p>
    </div>
  );
}
