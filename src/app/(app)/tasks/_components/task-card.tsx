"use client";

import { forwardRef, type HTMLAttributes } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Countdown } from "@/components/countdown";
import { ReminderBadge } from "@/components/reminder-badge";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-stone-400",
  med: "bg-amber-500",
  high: "bg-red-500"
};

export type TaskCardData = {
  id: string;
  title: string;
  priority: string;
  status: string;
  dueAt: Date | string | null;
  completedAt: Date | string | null;
  reminders: { id: string; level: string; fireAt: Date | string }[];
};

function isEarly(task: TaskCardData) {
  if (task.status !== "done") return false;
  if (!task.dueAt || !task.completedAt) return false;
  const due = new Date(task.dueAt).getTime();
  const completed = new Date(task.completedAt).getTime();
  return completed < due - 6 * 60 * 60 * 1000;
}

interface TaskCardProps extends HTMLAttributes<HTMLDivElement> {
  task: TaskCardData;
  isDragging?: boolean;
}

export const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(
  ({ task, isDragging, className, ...rest }, ref) => {
    const now = new Date();
    const activeReminder = task.reminders.find(
      (r) => new Date(r.fireAt).getTime() <= now.getTime()
    );

    return (
      <div
        ref={ref}
        className={cn(
          "group cursor-pointer rounded-lg border bg-card p-3.5 shadow-sm transition-colors hover:bg-accent/40",
          isDragging && "opacity-50 ring-2 ring-ring",
          task.status === "done" && "opacity-70",
          className
        )}
        {...rest}
      >
        <div className="flex items-start gap-2.5">
          <span
            aria-label={`priority ${task.priority}`}
            className={cn(
              "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
              PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.med
            )}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className={cn(
                "line-clamp-2 text-sm leading-snug",
                task.status === "done" && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {task.dueAt && task.status !== "done" && <Countdown dueAt={task.dueAt} />}
              {activeReminder && <ReminderBadge level={activeReminder.level} />}
              {isEarly(task) && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                  <Check className="h-3 w-3" />
                  early
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
TaskCard.displayName = "TaskCard";
