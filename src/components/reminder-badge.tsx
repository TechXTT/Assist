"use client";

import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";

const LEVEL_CLASS: Record<string, string> = {
  gentle: "border-stone-300 text-stone-700 dark:text-stone-300",
  firm: "border-amber-400 text-amber-700 dark:text-amber-300",
  urgent: "border-orange-500 text-orange-700 dark:text-orange-300",
  final: "border-red-500 text-red-700 dark:text-red-300"
};

export function ReminderBadge({ level, className }: { level: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium",
        LEVEL_CLASS[level] ?? LEVEL_CLASS.gentle,
        className
      )}
    >
      <Clock className="h-3 w-3" />
      heads up
    </span>
  );
}
