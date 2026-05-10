"use client";

import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money/format";
import { analyzeCredit } from "@/lib/money/credit";
import {
  aggregateGainLoss,
  type HoldingForMath
} from "@/lib/money/investments";
import { paidDownRatio, projectPayoff } from "@/lib/money/loans";
import { projectInterest } from "@/lib/money/savings";
import type { FinancialAccountRow } from "@/lib/money/account-queries";

function utilColor(ratio: number): string {
  if (ratio > 1) return "bg-red-600";
  if (ratio >= 0.8) return "bg-amber-600";
  if (ratio >= 0.5) return "bg-amber-500";
  return "bg-stone-400";
}

function paidColor(): string {
  return "bg-emerald-500";
}

export function AccountDetailEnrichment({
  account,
  holdings,
  currency,
  timezone
}: {
  account: FinancialAccountRow;
  holdings: HoldingForMath[];
  currency: string;
  timezone: string;
}) {
  if (account.type === "savings") {
    const projection = projectInterest({
      balanceCents: account.balanceCents,
      rateBps: account.rateBps
    });
    if (projection.kind === "computable") {
      const apy = (account.rateBps! / 100).toFixed(1);
      return (
        <p className="text-xs text-muted-foreground">
          ≈ {formatCents(projection.monthlyInterestCents, currency)}/mo interest at {apy}% APY
          <span className="opacity-60"> · estimate, assumes balance stays constant</span>
        </p>
      );
    }
    if (account.balanceCents > 0 && !account.rateBps) {
      return <p className="text-xs text-muted-foreground">Add an APY to see projected interest.</p>;
    }
    return null;
  }

  if (account.type === "credit") {
    const analysis = analyzeCredit({
      balanceCents: account.balanceCents,
      creditLimitCents: account.creditLimitCents,
      rateBps: account.rateBps,
      statementDay: account.statementDay,
      paymentDueDay: account.paymentDueDay,
      timezone
    });
    const hasUtil = typeof analysis.utilizationRatio === "number";
    const hasCarry = typeof analysis.monthlyCarryCostCents === "number";

    return (
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {hasUtil && (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span>
                {formatCents(account.balanceCents, currency)} of{" "}
                {formatCents(account.creditLimitCents ?? 0, currency)} used (
                {Math.round((analysis.utilizationRatio ?? 0) * 100)}%)
              </span>
              {(analysis.utilizationRatio ?? 0) > 0.8 && (
                <span className="text-amber-700 dark:text-amber-400">above 80% — heads up</span>
              )}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  utilColor(analysis.utilizationRatio ?? 0)
                )}
                style={{
                  width: `${Math.min(100, Math.round((analysis.utilizationRatio ?? 0) * 100))}%`
                }}
              />
            </div>
          </div>
        )}
        {hasCarry && account.balanceCents > 0 && (
          <p>
            ≈ {formatCents(analysis.monthlyCarryCostCents ?? 0, currency)}/mo at{" "}
            {((account.rateBps ?? 0) / 100).toFixed(1)}% APR if you keep this balance
          </p>
        )}
        {typeof analysis.daysUntilStatement === "number" && analysis.nextStatementDate && (
          <p>
            Statement closes in {analysis.daysUntilStatement}{" "}
            {analysis.daysUntilStatement === 1 ? "day" : "days"} ·{" "}
            {format(analysis.nextStatementDate, "d MMM")}
          </p>
        )}
        {typeof analysis.daysUntilPayment === "number" && analysis.nextPaymentDueDate && (
          <p>
            Payment due in {analysis.daysUntilPayment}{" "}
            {analysis.daysUntilPayment === 1 ? "day" : "days"} ·{" "}
            {format(analysis.nextPaymentDueDate, "d MMM")}
          </p>
        )}
      </div>
    );
  }

  if (account.type === "loan") {
    const payoff = projectPayoff({
      balanceCents: account.balanceCents,
      rateBps: account.rateBps,
      monthlyPaymentCents: account.monthlyPaymentCents
    });
    const paid = paidDownRatio(account.balanceCents, account.originalPrincipalCents);

    return (
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {paid !== null && account.originalPrincipalCents && (
          <div className="space-y-0.5">
            <div>
              {formatCents(account.originalPrincipalCents - account.balanceCents, currency)} of{" "}
              {formatCents(account.originalPrincipalCents, currency)} paid (
              {Math.round(paid * 100)}%)
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", paidColor())}
                style={{ width: `${Math.round(paid * 100)}%` }}
              />
            </div>
          </div>
        )}
        {payoff.kind === "computable" && (
          <p>
            On track to pay off in {payoff.monthsRemaining}{" "}
            {payoff.monthsRemaining === 1 ? "month" : "months"} —{" "}
            {format(payoff.payoffDate, "MMM yyyy")} · {formatCents(payoff.totalInterestProjectedCents, currency)}{" "}
            interest projected
          </p>
        )}
        {payoff.kind === "payment_too_low" && (
          <p>
            At this rate, payments don&apos;t cover monthly interest yet — bump the amount or check the rate.
          </p>
        )}
        {payoff.kind === "missing_data" && account.balanceCents > 0 && (
          <p>Add an interest rate and monthly payment to see payoff projection.</p>
        )}
      </div>
    );
  }

  if ((account.type === "investment" || account.type === "crypto") && account.trackHoldings) {
    const aggregate = aggregateGainLoss(holdings);
    if (aggregate) {
      return (
        <p className="text-xs">
          <span className="text-muted-foreground">Total gain/loss: </span>
          <span
            className={cn(
              "tabular-nums",
              aggregate.absoluteCents > 0 && "text-emerald-600 dark:text-emerald-400",
              aggregate.absoluteCents < 0 && "text-amber-700 dark:text-amber-400",
              aggregate.absoluteCents === 0 && "text-muted-foreground"
            )}
          >
            {aggregate.absoluteCents > 0 ? "+" : ""}
            {formatCents(aggregate.absoluteCents, currency)} ·{" "}
            {aggregate.absoluteCents > 0 ? "+" : ""}
            {(aggregate.ratio * 100).toFixed(1)}%
          </span>
        </p>
      );
    }
    return null;
  }

  return null;
}
