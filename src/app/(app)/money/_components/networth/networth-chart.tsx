"use client";

import { useMemo, useState } from "react";
import { format, subDays, subMonths, subYears } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";

type RangeKey = "1m" | "3m" | "6m" | "1y" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" }
];

function rangeStart(key: RangeKey, now: Date): Date | null {
  switch (key) {
    case "1m":
      return subDays(now, 30);
    case "3m":
      return subMonths(now, 3);
    case "6m":
      return subMonths(now, 6);
    case "1y":
      return subYears(now, 1);
    case "all":
      return null;
  }
}

export type ChartPoint = { at: Date | string; totalCents: number };

export function NetworthChart({
  history,
  currency
}: {
  history: ChartPoint[];
  currency: string;
}) {
  const [range, setRange] = useState<RangeKey>("6m");

  const data = useMemo(() => {
    const cutoff = rangeStart(range, new Date());
    return history
      .map((p) => ({ at: new Date(p.at), totalCents: p.totalCents }))
      .filter((p) => (cutoff === null ? true : p.at >= cutoff))
      .map((p) => ({ ts: p.at.getTime(), totalCents: p.totalCents }));
  }, [history, range]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2 space-y-0">
        <CardTitle className="text-base">Net worth over time</CardTitle>
        <div className="inline-flex rounded-md border bg-background p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                range === r.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Log at least two snapshots to see the line.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(v: number) => format(new Date(v), "d MMM")}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickMargin={8}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCents(v, currency)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 6,
                    fontSize: 12
                  }}
                  labelFormatter={(v: number) => format(new Date(v), "EEE d MMM yyyy")}
                  formatter={(v: number) => [formatCents(v, currency), "Net worth"]}
                />
                <Line
                  type="monotone"
                  dataKey="totalCents"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(var(--foreground))" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
