import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";
import type { RecurringBreakdownRow } from "@/lib/money/cashflow";

const KIND_LABEL: Record<RecurringBreakdownRow["kind"], string> = {
  bill: "Bill",
  subscription: "Subscription",
  loan_payment: "Loan",
  credit_payment: "Credit"
};

export function RecurringSummary({
  monthlyCents,
  annualizedCents,
  breakdown,
  currency
}: {
  monthlyCents: number;
  annualizedCents: number;
  breakdown: RecurringBreakdownRow[];
  currency: string;
}) {
  const subsCents = breakdown
    .filter((b) => b.kind === "subscription")
    .reduce((s, b) => s + b.monthlyCents, 0);
  const showCreepCallout =
    subsCents > 5000 || (monthlyCents > 0 && subsCents / monthlyCents > 0.2);
  const creepPct = monthlyCents > 0 ? Math.round((subsCents / monthlyCents) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recurring outflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-0.5">
          <p className="text-2xl font-semibold tabular-nums">
            {formatCents(monthlyCents, currency)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">/ month</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Annualized: {formatCents(annualizedCents, currency)}
          </p>
        </div>

        {showCreepCallout && (
          <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Heads up — subscriptions add up to {formatCents(subsCents, currency)}/month
            {monthlyCents > 0 && <>, about {creepPct}% of your monthly recurring</>}.
          </p>
        )}

        {breakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing recurring yet. Add a bill or subscription to see it here.
          </p>
        ) : (
          <ul className="divide-y rounded-md border bg-background text-sm">
            {breakdown.map((b, i) => (
              <li key={`${b.kind}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {KIND_LABEL[b.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
                {b.category && <span className="text-xs text-muted-foreground">{b.category}</span>}
                <span className="shrink-0 tabular-nums">
                  {formatCents(b.monthlyCents, currency)}/mo
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
