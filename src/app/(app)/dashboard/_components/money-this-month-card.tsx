"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ArrowDown, ArrowUp, LineChart, Receipt, Target, TrendingDown, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money/format";
import type { DashboardMoneySummary } from "@/lib/money/dashboard-summary";

const DAY_MS = 24 * 60 * 60 * 1000;

function progressBarClass(spent: number, limit: number): string {
  if (limit <= 0) return "bg-stone-400";
  const pct = (spent / limit) * 100;
  if (pct > 100) return "bg-red-500";
  if (pct >= 80) return "bg-orange-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-stone-400";
}

function daysFromNow(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.round((date.getTime() - now.getTime()) / DAY_MS));
}

export function MoneyThisMonthCard({
  summary,
  currency
}: {
  summary: DashboardMoneySummary;
  currency: string;
}) {
  const router = useRouter();

  const showNet =
    summary.hasIncomeActivity || summary.nextIncome !== null;

  const hasData =
    summary.totalSpentCents > 0 ||
    summary.upcomingBills.count > 0 ||
    summary.goals.count > 0 ||
    showNet;

  function navigate() {
    router.push("/money");
  }

  const netNegative = summary.net.netCents < 0;

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={navigate}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate();
      }}
      className="cursor-pointer transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Money this month</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            Nothing logged yet — head over to{" "}
            <Link
              href="/money"
              onClick={(e) => e.stopPropagation()}
              className="underline-offset-2 hover:underline"
            >
              Money
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <>
            <div>
              {showNet ? (
                <>
                  <p
                    className={cn(
                      "text-2xl font-semibold tabular-nums",
                      netNegative && "text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {formatCents(summary.net.netCents, currency)}{" "}
                    <span className="text-sm font-normal text-muted-foreground">net this month</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCents(summary.net.inCents, currency)} in ·{" "}
                    {formatCents(summary.net.outCents, currency)} out
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCents(summary.totalSpentCents, currency)}
                  </p>
                  {summary.totalBudgetedCents > 0 && (
                    <p className="text-xs text-muted-foreground">
                      of {formatCents(summary.totalBudgetedCents, currency)} budgeted across all
                      categories
                    </p>
                  )}
                </>
              )}
            </div>

            {summary.topCategories.length > 0 && (
              <ul className="space-y-1.5">
                {summary.topCategories.map((c) => {
                  const pct =
                    c.limitCents > 0
                      ? Math.min(100, Math.round((c.spentCents / c.limitCents) * 100))
                      : 0;
                  return (
                    <li key={c.name} className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="flex-1 truncate">{c.name}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatCents(c.spentCents, currency)}
                          {c.limitCents > 0 && (
                            <>
                              {" "}/ {formatCents(c.limitCents, currency)}
                            </>
                          )}
                        </span>
                      </div>
                      {c.limitCents > 0 && (
                        <div className="h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              progressBarClass(c.spentCents, c.limitCents)
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {summary.hotBudgets.length > 0 && (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
                Heads up — {summary.hotBudgets.length === 1 ? (
                  <>
                    <span className="font-medium">{summary.hotBudgets[0].name}</span> is at{" "}
                    {summary.hotBudgets[0].percentUsed}% with {summary.hotBudgets[0].daysRemaining}{" "}
                    {summary.hotBudgets[0].daysRemaining === 1 ? "day" : "days"} to go.
                  </>
                ) : (
                  <>{summary.hotBudgets.length} budgets running hot.</>
                )}
              </div>
            )}

            <div className="space-y-2 border-t pt-3 text-xs">
              <Link
                href="/money?tab=bills"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                <Receipt className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  {summary.upcomingBills.count > 0
                    ? `${summary.upcomingBills.count} bill${
                        summary.upcomingBills.count === 1 ? "" : "s"
                      } due — ${formatCents(summary.upcomingBills.totalCents, currency)} total`
                    : "No bills due in the next 7 days"}
                </span>
              </Link>

              {summary.nextIncome && (
                <Link
                  href="/money?tab=income"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <Wallet className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">
                    Next:{" "}
                    <span className="font-medium">{summary.nextIncome.name}</span>{" "}
                    in {daysFromNow(summary.nextIncome.expectedAt)}{" "}
                    {daysFromNow(summary.nextIncome.expectedAt) === 1 ? "day" : "days"} ·{" "}
                    {formatCents(summary.nextIncome.amountCents, currency)} expected
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {format(summary.nextIncome.expectedAt, "d MMM")}
                  </span>
                </Link>
              )}

              {summary.netWorth && (
                <Link
                  href="/money?tab=networth"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <LineChart className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">
                    Net worth:{" "}
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        summary.netWorth.totalCents < 0 &&
                          "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {formatCents(summary.netWorth.totalCents, currency)}
                    </span>
                    {summary.netWorth.deltaThisMonthCents !== 0 && (
                      <>
                        {" "}
                        ·{" "}
                        {summary.netWorth.deltaThisMonthCents > 0 ? (
                          <ArrowUp className="inline h-3 w-3" aria-hidden />
                        ) : (
                          <ArrowDown className="inline h-3 w-3" aria-hidden />
                        )}{" "}
                        <span className="tabular-nums">
                          {formatCents(
                            Math.abs(summary.netWorth.deltaThisMonthCents),
                            currency
                          )}
                        </span>{" "}
                        this month
                      </>
                    )}
                  </span>
                </Link>
              )}

              {summary.cashFlow && (
                <Link
                  href="/money?tab=cashflow"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  <span className="flex-1">
                    Next {summary.cashFlow.horizonDays} days:{" "}
                    {summary.cashFlow.netProjectedCents >= 0 ? (
                      <ArrowUp className="inline h-3 w-3" aria-hidden />
                    ) : (
                      <ArrowDown className="inline h-3 w-3" aria-hidden />
                    )}{" "}
                    <span
                      className={cn(
                        "tabular-nums",
                        summary.cashFlow.netProjectedCents < 0 &&
                          "text-amber-700 dark:text-amber-400"
                      )}
                    >
                      {formatCents(
                        Math.abs(summary.cashFlow.netProjectedCents),
                        currency
                      )}
                    </span>{" "}
                    projected
                    {summary.cashFlow.firstTightSpot && (
                      <>
                        {" "}· {summary.cashFlow.tightSpotCount} tight spot
                        {summary.cashFlow.tightSpotCount === 1 ? "" : "s"} on{" "}
                        {format(summary.cashFlow.firstTightSpot.at, "d MMM")}
                      </>
                    )}
                  </span>
                </Link>
              )}

              <Link
                href="/money?tab=goals"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
              >
                <Target className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  {summary.goals.count > 0
                    ? `${formatCents(summary.goals.savedCents, currency)} of ${formatCents(
                        summary.goals.targetCents,
                        currency
                      )} saved across ${summary.goals.count} goal${
                        summary.goals.count === 1 ? "" : "s"
                      }`
                    : "No goals yet"}
                </span>
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
