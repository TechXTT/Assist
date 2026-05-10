"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { HabitDay } from "@/lib/health/habit-queries";

type Point = { dateKey: string; label: string; hours: number | null };

export function SleepChart({
  days,
  targetHours
}: {
  days: HabitDay[];
  targetHours: number | null;
}) {
  const data: Point[] = useMemo(
    () =>
      days.map((d) => ({
        dateKey: d.dateKey,
        label: d.dateKey.slice(5), // "MM-DD"
        hours: d.sleepHours
      })),
    [days]
  );

  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            width={28}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            domain={[0, 12]}
            ticks={[0, 4, 8, 12]}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12
            }}
            formatter={(value: unknown) =>
              typeof value === "number"
                ? [`${value.toFixed(1)}h`, "Sleep"]
                : ["—", "Sleep"]
            }
          />
          {targetHours !== null && targetHours > 0 && (
            <ReferenceLine
              y={targetHours}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              ifOverflow="extendDomain"
            />
          )}
          <Bar dataKey="hours" fill="hsl(var(--muted-foreground) / 0.6)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
