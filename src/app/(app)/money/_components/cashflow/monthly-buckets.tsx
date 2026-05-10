import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";
import type { MonthlyBucket } from "@/lib/money/cashflow";

export function MonthlyBuckets({
  buckets,
  currency
}: {
  buckets: MonthlyBucket[];
  currency: string;
}) {
  if (buckets.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {buckets.map((b) => {
        const negative = b.netCents < 0;
        const ratio =
          b.inCents + b.outCents > 0 ? b.inCents / (b.inCents + b.outCents) : 0;
        return (
          <Card key={b.monthStart.toISOString()}>
            <CardContent className="space-y-2 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {format(b.monthStart, "MMMM yyyy")}
              </p>
              <div className="space-y-0.5 text-xs">
                <p className="tabular-nums">
                  {formatCents(b.inCents, currency)} in ·{" "}
                  {formatCents(b.outCents, currency)} out
                </p>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    negative && "text-amber-700 dark:text-amber-400"
                  )}
                >
                  {negative ? "▼" : "▲"} {formatCents(Math.abs(b.netCents), currency)} net
                </p>
              </div>
              <div className="flex h-1 overflow-hidden rounded-full bg-muted">
                <div className="bg-emerald-500/70" style={{ width: `${Math.round(ratio * 100)}%` }} />
                <div
                  className="bg-amber-500/70"
                  style={{ width: `${Math.round((1 - ratio) * 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
