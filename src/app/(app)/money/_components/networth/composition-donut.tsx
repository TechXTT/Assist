"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";
import {
  ACCOUNT_TYPE_META,
  isKnownAccountType
} from "@/lib/money/account-type-meta";

export type CompositionRow = {
  key: string; // account type, or "liability:<type>" for liability slices
  type: string;
  isLiability: boolean;
  amountCents: number;
};

export function CompositionDonut({
  rows,
  selected,
  onSelect,
  currency
}: {
  rows: CompositionRow[];
  selected: string | null;
  onSelect: (next: string | null) => void;
  currency: string;
}) {
  const data = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        label: isKnownAccountType(r.type) ? ACCOUNT_TYPE_META[r.type].label : r.type,
        color: r.isLiability ? "#ef4444" : ACCOUNT_TYPE_META[r.type as keyof typeof ACCOUNT_TYPE_META]?.color ?? "#a8a29e"
      })),
    [rows]
  );

  const total = data.reduce((s, r) => s + r.amountCents, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Composition</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Add an account to see the breakdown.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-center">
            <div className="relative mx-auto h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="amountCents"
                    nameKey="label"
                    innerRadius={45}
                    outerRadius={72}
                    paddingAngle={1}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {data.map((d) => (
                      <Cell key={d.key} fill={d.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-muted-foreground">
                <span>
                  {data.length} {data.length === 1 ? "slice" : "slices"}
                </span>
              </div>
            </div>

            <ul className="space-y-1.5">
              {data.map((d) => {
                const isSelected =
                  selected === (d.isLiability ? "liability" : d.type);
                const filterKey = d.isLiability ? "liability" : d.type;
                return (
                  <li key={d.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(isSelected ? null : filterKey)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
                        isSelected ? "bg-muted" : "hover:bg-muted/60"
                      )}
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      <span className="flex-1 truncate">
                        {d.label}
                        {d.isLiability && (
                          <span className="text-muted-foreground"> (liability)</span>
                        )}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatCents(d.amountCents, currency)}
                      </span>
                      {total > 0 && (
                        <span className="w-9 shrink-0 text-right tabular-nums text-muted-foreground">
                          {Math.round((d.amountCents / total) * 100)}%
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {selected && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear filter
          </button>
        )}
      </CardContent>
    </Card>
  );
}
