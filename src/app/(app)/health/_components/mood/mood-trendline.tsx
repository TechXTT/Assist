"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { HabitDay } from "@/lib/health/habit-queries";

export function MoodTrendline({ days }: { days: HabitDay[] }) {
  const data = useMemo(
    () =>
      days.map((d) => ({
        label: d.dateKey.slice(5),
        mood: d.mood
      })),
    [days]
  );

  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            width={20}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            domain={[1, 5]}
            ticks={[1, 2, 3, 4, 5]}
          />
          <Tooltip
            cursor={{ stroke: "hsl(var(--muted) / 0.4)" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              fontSize: 12
            }}
            formatter={(value: unknown) =>
              typeof value === "number" ? [String(value), "Mood"] : ["—", "Mood"]
            }
          />
          <Line
            type="monotone"
            dataKey="mood"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
