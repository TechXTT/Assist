import { ArrowDown, ArrowUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";

export function NetworthSummaryCard({
  totalCents,
  assetCents,
  liabilityCents,
  deltaThisMonthCents,
  currency
}: {
  totalCents: number;
  assetCents: number;
  liabilityCents: number;
  deltaThisMonthCents: number;
  currency: string;
}) {
  const negative = totalCents < 0;
  const deltaPositive = deltaThisMonthCents > 0;
  const deltaNegative = deltaThisMonthCents < 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Net worth</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              negative && "text-amber-700 dark:text-amber-400"
            )}
          >
            {formatCents(totalCents, currency)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatCents(assetCents, currency)} assets ·{" "}
            {formatCents(liabilityCents, currency)} liabilities
          </p>
        </div>

        {deltaThisMonthCents !== 0 && (
          <p className="flex items-center gap-1.5 text-xs">
            {deltaPositive && <ArrowUp className="h-3 w-3" aria-hidden />}
            {deltaNegative && <ArrowDown className="h-3 w-3" aria-hidden />}
            <span className="tabular-nums">
              {formatCents(Math.abs(deltaThisMonthCents), currency)}
            </span>
            <span className="text-muted-foreground">this month</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
