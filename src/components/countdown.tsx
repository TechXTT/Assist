"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { urgencyOf, urgencyTextClass } from "@/lib/tasks/urgency";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function formatRelative(diffMs: number): string {
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  if (abs < 60 * 1000) return overdue ? "overdue" : "due now";

  const days = Math.floor(abs / DAY);
  const hours = Math.floor((abs % DAY) / HOUR);
  const minutes = Math.floor((abs % HOUR) / (60 * 1000));

  let core: string;
  if (days >= 1) {
    core = hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  } else if (hours >= 1) {
    core = minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else {
    core = `${minutes}m`;
  }
  return overdue ? `overdue ${core}` : `in ${core}`;
}

function tickRate(diffMs: number): number {
  const abs = Math.abs(diffMs);
  if (abs < HOUR) return 10 * 1000;
  if (abs < DAY) return 60 * 1000;
  return 60 * 60 * 1000;
}

export function Countdown({
  dueAt,
  className
}: {
  dueAt: Date | string | null | undefined;
  className?: string;
}) {
  const target = useMemo(() => (dueAt ? new Date(dueAt) : null), [dueAt]);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      if (cancelled) return;
      const diff = target.getTime() - Date.now();
      timer = setTimeout(() => {
        if (cancelled) return;
        setNow(new Date());
        schedule();
      }, tickRate(diff));
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target]);

  if (!target) return null;
  const diff = target.getTime() - now.getTime();
  const u = urgencyOf(target, now);
  return <span className={cn("text-xs", urgencyTextClass[u], className)}>{formatRelative(diff)}</span>;
}
