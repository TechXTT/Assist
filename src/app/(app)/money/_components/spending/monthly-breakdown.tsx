"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";

export type BreakdownRow = { category: string; amountCents: number; color: string };

export function MonthlyBreakdown({
  total,
  rows,
  currency
}: {
  total: number;
  rows: BreakdownRow[];
  currency: string;
}) {
  const top = useMemo(() => rows.slice(0, 5), [rows]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">This month</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing logged this month yet.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
            <div className="relative mx-auto h-44 w-44">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rows}
                    dataKey="amountCents"
                    nameKey="category"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={1}
                    stroke="none"
                  >
                    {rows.map((r) => (
                      <Cell key={r.category} fill={r.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">spent</span>
                <span className="text-base font-semibold tabular-nums">
                  {formatCents(total, currency)}
                </span>
              </div>
            </div>
            <ul className="space-y-1.5">
              {top.map((r) => {
                const pct = total > 0 ? Math.round((r.amountCents / total) * 100) : 0;
                return (
                  <li key={r.category} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                      <span className="flex-1 truncate">{r.category}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatCents(r.amountCents, currency)}
                      </span>
                      <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: r.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
