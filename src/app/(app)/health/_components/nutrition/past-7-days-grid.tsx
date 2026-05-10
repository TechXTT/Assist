"use client";

import type { HabitDay } from "@/lib/health/habit-queries";

function dayLabel(dateKey: string): string {
  // dateKey is YYYY-MM-DD (user local). Use UTC anchor to get a stable weekday.
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

export function Past7DaysGrid({ days }: { days: HabitDay[] }) {
  return (
    <ul className="grid grid-cols-7 gap-1 text-center text-xs">
      {days.map((d) => (
        <li
          key={d.dateKey}
          className="space-y-0.5 rounded-md border bg-card px-1 py-1.5"
          aria-label={`${dayLabel(d.dateKey)} — ${d.waterGlasses} glasses, ${d.mealsLogged} meals`}
        >
          <p className="font-medium text-muted-foreground">{dayLabel(d.dateKey)}</p>
          <p className="tabular-nums">{d.waterGlasses}<span className="text-muted-foreground">w</span></p>
          <p className="tabular-nums">{d.mealsLogged}<span className="text-muted-foreground">m</span></p>
        </li>
      ))}
    </ul>
  );
}
