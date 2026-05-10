import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceChart } from "@/app/(app)/money/_components/cashflow/balance-chart";
import { CashFlowSummaryRow } from "@/app/(app)/money/_components/cashflow/summary-row";
import { EventsTimeline } from "@/app/(app)/money/_components/cashflow/events-timeline";
import { IncompleteAccountsHint } from "@/app/(app)/money/_components/cashflow/incomplete-accounts-hint";
import { MonthlyBuckets } from "@/app/(app)/money/_components/cashflow/monthly-buckets";
import { RecurringSummary } from "@/app/(app)/money/_components/cashflow/recurring-summary";
import type { Forecast } from "@/lib/money/cashflow";
import type { DiscretionaryAuto } from "@/lib/money/discretionary";
import type { FinancialAccountRow } from "@/lib/money/account-queries";

export function CashFlowTab({
  forecast,
  accounts,
  startingBalanceCents,
  cashFlowAccountCount,
  horizonDays,
  thresholdCents,
  includeDiscretionary,
  discretionaryAuto,
  hasIncome,
  hasOutflows,
  currency
}: {
  forecast: Forecast;
  accounts: FinancialAccountRow[];
  startingBalanceCents: number;
  cashFlowAccountCount: number;
  horizonDays: number;
  thresholdCents: number;
  includeDiscretionary: boolean;
  discretionaryAuto: DiscretionaryAuto;
  hasIncome: boolean;
  hasOutflows: boolean;
  currency: string;
}) {
  return (
    <div className="space-y-6">
      <CashFlowSummaryRow
        startingBalanceCents={startingBalanceCents}
        cashFlowAccountCount={cashFlowAccountCount}
        horizonDays={horizonDays}
        thresholdCents={thresholdCents}
        accounts={accounts}
        currency={currency}
      />

      {!hasIncome && (
        <Card>
          <CardContent className="px-6 py-4 text-sm text-muted-foreground">
            Add an{" "}
            <Link href="/money?tab=income" className="underline-offset-2 hover:underline">
              income source
            </Link>{" "}
            to start projecting forward.
          </CardContent>
        </Card>
      )}

      {hasIncome && !hasOutflows && (
        <Card>
          <CardContent className="px-6 py-4 text-sm text-muted-foreground">
            Looks like you only have income modeled — your forecast won&apos;t show outflows.
            Add bills, subscriptions, or loan/credit payments to see the full picture.
          </CardContent>
        </Card>
      )}

      <BalanceChart
        runningBalance={forecast.runningBalance}
        tightSpots={forecast.tightSpots}
        thresholdCents={thresholdCents}
        currency={currency}
      />

      {forecast.incompleteAccounts.length > 0 && (
        <IncompleteAccountsHint accounts={forecast.incompleteAccounts} />
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Monthly outlook</h2>
        {forecast.monthlyBuckets.length > 0 ? (
          <MonthlyBuckets buckets={forecast.monthlyBuckets} currency={currency} />
        ) : (
          <p className="rounded-md border border-dashed bg-muted/20 px-6 py-6 text-center text-sm text-muted-foreground">
            No events in horizon yet.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Events</h2>
        <EventsTimeline events={forecast.events} currency={currency} />
      </section>

      <RecurringSummary
        monthlyCents={forecast.recurringMonthlyTotalCents}
        annualizedCents={forecast.recurringAnnualizedCents}
        breakdown={forecast.recurringBreakdown}
        currency={currency}
      />

      {includeDiscretionary && discretionaryAuto.cents === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Discretionary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Discretionary estimate will appear after about 2 weeks of logged spending.
              You have {discretionaryAuto.basedOnDays} day
              {discretionaryAuto.basedOnDays === 1 ? "" : "s"} of history so far.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
