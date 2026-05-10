"use client";

import Link from "next/link";
import { useTransition } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { dismissReminder } from "@/app/(app)/tasks/actions";
import { Countdown } from "@/components/countdown";

export type ReminderRow = {
  id: string;
  level: string;
  fireAt: Date | string;
  task: { id: string; title: string; dueAt: Date | string | null };
};

const STRIPE: Record<string, string> = {
  gentle: "bg-stone-400",
  firm: "bg-amber-500",
  urgent: "bg-orange-500",
  final: "bg-red-600"
};

const LEAD_IN: Record<string, string> = {
  gentle: "Heads up —",
  firm: "Coming up —",
  urgent: "Soon —",
  final: "Right now —"
};

export function ReminderBanners({ reminders }: { reminders: ReminderRow[] }) {
  if (reminders.length === 0) return null;
  const visible = reminders.slice(0, 3);

  return (
    <div className="space-y-2">
      {visible.map((r) => (
        <Banner key={r.id} reminder={r} />
      ))}
    </div>
  );
}

function Banner({ reminder }: { reminder: ReminderRow }) {
  const [pending, start] = useTransition();
  const dueAt = reminder.task.dueAt ? new Date(reminder.task.dueAt) : null;

  return (
    <div className="flex items-stretch overflow-hidden rounded-md border bg-background">
      <div className={cn("w-1 shrink-0", STRIPE[reminder.level] ?? STRIPE.gentle)} />
      <div className="flex flex-1 items-center gap-3 px-3 py-2.5">
        <div className="flex-1 text-sm leading-snug">
          <span className="text-muted-foreground">{LEAD_IN[reminder.level] ?? LEAD_IN.gentle}</span>{" "}
          <Link href="/tasks" className="font-medium hover:underline">
            {reminder.task.title}
          </Link>{" "}
          {dueAt && <Countdown dueAt={dueAt} className="ml-1" />}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          disabled={pending}
          onClick={() => start(() => dismissReminder(reminder.id))}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
