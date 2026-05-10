"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";
import type {
  RunningBalancePoint,
  TightSpot
} from "@/lib/money/cashflow";

export function BalanceChart({
  runningBalance,
  tightSpots,
  thresholdCents,
  currency
}: {
  runningBalance: RunningBalancePoint[];
  tightSpots: TightSpot[];
  thresholdCents: number;
  currency: string;
}) {
  const data = useMemo(
    () =>
      runningBalance.map((p) => ({
        ts: new Date(p.at).getTime(),
        above: p.balanceCents >= thresholdCents ? p.balanceCents : null,
        below: p.balanceCents < thresholdCents ? p.balanceCents : null
      })),
    [runningBalance, thresholdCents]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Running balance</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Not enough events to project. Add an income source and a few outflows.
          </p>
        ) : (
          <>
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
                    labelFormatter={(v) =>
                      typeof v === "number" ? format(new Date(v), "EEE d MMM yyyy") : ""
                    }
                    formatter={(value) => {
                      if (typeof value !== "number") return ["—", "Balance"];
                      return [formatCents(value, currency), "Balance"];
                    }}
                  />
                  <ReferenceLine
                    y={thresholdCents}
                    stroke="hsl(43 96% 56%)"
                    strokeDasharray="4 4"
                    strokeOpacity={0.7}
                  />
                  <Line
                    type="monotone"
                    dataKey="above"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "hsl(var(--muted-foreground))" }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="below"
                    stroke="hsl(32 95% 44%)"
                    strokeWidth={2}
                    dot={{ r: 2.5, fill: "hsl(32 95% 44%)" }}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {tightSpots.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {tightSpots.map((s, i) => (
                  <li
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100"
                  >
                    <span>{format(new Date(s.at), "d MMM")}</span>
                    <span className="opacity-70">dips to</span>
                    <span className="tabular-nums">{formatCents(s.balanceCents, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
