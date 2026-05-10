"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { setCalendarSyncEnabled } from "@/app/(app)/settings/actions";

export type CalendarRow = {
  id: string;
  summary: string;
  backgroundColor: string | null;
  primary: boolean;
  syncEnabled: boolean;
  accessRole: string | null;
};

export function CalendarsList({ calendars }: { calendars: CalendarRow[] }) {
  if (calendars.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading your calendars… they'll show up after the first sync.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {calendars.map((c) => (
        <CalendarRowItem key={c.id} calendar={c} />
      ))}
    </ul>
  );
}

function CalendarRowItem({ calendar }: { calendar: CalendarRow }) {
  // Local state for snappier toggle feel; rolled back if the action fails.
  const [enabled, setEnabled] = useState(calendar.syncEnabled);
  const [pending, start] = useTransition();

  function onChange(next: boolean) {
    if (pending) return;
    setEnabled(next);
    start(async () => {
      const result = await setCalendarSyncEnabled(calendar.id, next);
      if (result.ok) {
        toast.success(
          result.enabled ? `Showing — ${result.summary}` : `Hidden — ${result.summary}`
        );
      } else {
        setEnabled(!next);
        if (result.reason === "reauth") toast.message(result.message);
        else toast.error(result.message);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/40">
      <span
        aria-hidden
        className="h-2.5 w-2.5 shrink-0 rounded-full border"
        style={{
          backgroundColor: calendar.backgroundColor ?? "transparent",
          borderColor: calendar.backgroundColor ?? "hsl(var(--border))"
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm">{calendar.summary}</p>
          {calendar.primary && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Primary
            </span>
          )}
        </div>
        {calendar.accessRole && !calendar.primary && (
          <p className="text-xs text-muted-foreground">{calendar.accessRole}</p>
        )}
      </div>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={onChange}
        aria-label={`Toggle sync for ${calendar.summary}`}
        className={cn(pending && "opacity-70")}
      />
    </li>
  );
}
