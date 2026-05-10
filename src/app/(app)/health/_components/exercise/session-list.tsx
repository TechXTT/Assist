"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { HEALTH_COPY } from "@/lib/health/copy";
import { deleteSession } from "@/app/(app)/health/actions";
import type { ExerciseSessionRow } from "@/lib/health/exercise-queries";

import { SessionDialog } from "@/app/(app)/health/_components/exercise/session-dialog";

function localDateKey(d: Date, tz: string): string {
  const local = toZonedTime(d, tz);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

function dayLabel(dateUtc: Date, tz: string, todayKey: string, yesterdayKey: string) {
  const key = localDateKey(dateUtc, tz);
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return format(toZonedTime(dateUtc, tz), "EEE, d MMM");
}

export function SessionList({
  sessions,
  timezone
}: {
  sessions: ExerciseSessionRow[];
  timezone: string;
}) {
  const [editing, setEditing] = useState<ExerciseSessionRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExerciseSessionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { todayKey, yesterdayKey } = useMemo(() => {
    const now = new Date();
    const today = localDateKey(now, timezone);
    const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterday = localDateKey(y, timezone);
    return { todayKey: today, yesterdayKey: yesterday };
  }, [timezone]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExerciseSessionRow[]>();
    for (const s of sessions) {
      const key = localDateKey(s.occurredAt, timezone);
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      label: dayLabel(list[0].occurredAt, timezone, todayKey, yesterdayKey),
      total: list.reduce((s, x) => s + x.minutes, 0),
      sessions: list
    }));
  }, [sessions, timezone, todayKey, yesterdayKey]);

  async function onConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSession(pendingDelete.id);
      toast.success("Removed.");
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <ul className="space-y-4">
        {grouped.map((day) => (
          <li key={day.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium text-muted-foreground">{day.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {HEALTH_COPY.exercise.minutesLabel(day.total)}
              </span>
            </div>
            <ul className="divide-y rounded-md border bg-card">
              {day.sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{s.activity}</p>
                    {s.notes && (
                      <p className="truncate text-xs text-muted-foreground">{s.notes}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">
                    {HEALTH_COPY.exercise.minutesLabel(s.minutes)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Edit session"
                      onClick={() => setEditing(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label="Delete session"
                      onClick={() => setPendingDelete(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {editing && (
        <SessionDialog
          mode="edit"
          session={editing}
          timezone={timezone}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => {
          if (!o) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {HEALTH_COPY.exercise.deleteConfirm}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {HEALTH_COPY.exercise.cancelCta}
            </AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmDelete} disabled={deleting}>
              {deleting ? "Removing…" : HEALTH_COPY.exercise.deleteCta}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
