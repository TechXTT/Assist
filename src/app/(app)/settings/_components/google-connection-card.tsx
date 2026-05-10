"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { syncNowAction } from "@/app/(app)/settings/actions";
import { DisconnectGoogleDialog } from "@/app/(app)/settings/_components/disconnect-google-dialog";
import {
  CalendarsList,
  type CalendarRow
} from "@/app/(app)/settings/_components/calendars-list";

function lastSyncCopy(at: Date | null) {
  if (!at) return "Never synced yet.";
  return `Last sync ${formatDistanceToNow(at, { addSuffix: true })}.`;
}

export function GoogleConnectionCard({
  email,
  lastCalendarSyncAt,
  calendars
}: {
  email: string;
  lastCalendarSyncAt: Date | null;
  calendars: CalendarRow[];
}) {
  const [pending, start] = useTransition();

  function onSyncNow() {
    start(async () => {
      const result = await syncNowAction();
      if (result.ok) {
        const { added, updated, removed, calendarsSynced } = result.counts;
        toast.success(
          `Synced — ${added} added, ${updated} updated, ${removed} removed across ${calendarsSynced} calendar${
            calendarsSynced === 1 ? "" : "s"
          }.`
        );
      } else {
        if (result.reason === "reauth") toast.message(result.message);
        else toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Google Calendar</CardTitle>
        <CardDescription>Read-only sync of your primary calendar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Account</dt>
            <dd className="truncate font-medium">{email}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-muted-foreground">{lastSyncCopy(lastCalendarSyncAt)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <DisconnectGoogleDialog />
          <Button size="sm" variant="outline" onClick={onSyncNow} disabled={pending} className="gap-1.5">
            <RefreshCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {pending ? "Syncing…" : "Sync now"}
          </Button>
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium">Calendars</h3>
            <p className="text-xs text-muted-foreground">
              Toggle which calendars show up on your dashboard.
            </p>
          </div>
          <CalendarsList calendars={calendars} />
        </div>
      </CardContent>
    </Card>
  );
}
