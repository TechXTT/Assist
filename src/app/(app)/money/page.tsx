import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listFinancialAccounts } from "@/lib/money/account-queries";
import { buildForecastWithThreshold } from "@/lib/money/cashflow";
import { computeDiscretionaryDaily } from "@/lib/money/discretionary";
import { listAllHoldings } from "@/lib/money/holding-queries";
import { listBills } from "@/lib/money/bill-queries";
import { listBudgets } from "@/lib/money/budget-queries";
import { listCategories } from "@/lib/money/category-queries";
import { listGoals } from "@/lib/money/goal-queries";
import { listIncomeSources } from "@/lib/money/income-queries";
import {
  calculateNetWorth,
  netWorthAtDate,
  netWorthHistory
} from "@/lib/money/networth";
import { listSubscriptions } from "@/lib/money/subscription-queries";
import {
  listTransactions,
  monthlyBreakdown,
  monthlyIncomeSummary,
  type TransactionTypeFilter
} from "@/lib/money/transaction-queries";
import { currentMonth, customRange, lastMonth, type Range } from "@/lib/money/period";
import {
  MoneyTabs,
  type MoneyTab
} from "@/app/(app)/money/_components/money-tabs";
import { SpendingTab } from "@/app/(app)/money/_components/spending/spending-tab";
import { BudgetsTab } from "@/app/(app)/money/_components/budgets/budgets-tab";
import { BillsAndSubsTab } from "@/app/(app)/money/_components/bills-and-subs/bills-and-subs-tab";
import { IncomeTab } from "@/app/(app)/money/_components/income/income-tab";
import { GoalsTab } from "@/app/(app)/money/_components/goals/goals-tab";
import { NetworthTab } from "@/app/(app)/money/_components/networth/networth-tab";
import { CashFlowTab } from "@/app/(app)/money/_components/cashflow/cashflow-tab";

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  period?: string;
  from?: string;
  to?: string;
  categories?: string;
  type?: string;
};

function readTab(value: string | undefined): MoneyTab {
  if (
    value === "budgets" ||
    value === "bills" ||
    value === "income" ||
    value === "goals" ||
    value === "cashflow" ||
    value === "networth"
  )
    return value;
  return "spending";
}

function readPeriod(value: string | undefined): "this" | "last" | "custom" {
  if (value === "last" || value === "custom") return value;
  return "this";
}

function readType(value: string | undefined): TransactionTypeFilter {
  if (value === "all" || value === "income") return value;
  return "expenses";
}

function defaultDateInput(d: Date, tz: string): string {
  return format(toZonedTime(d, tz), "yyyy-MM-dd");
}

function resolveRange(
  period: "this" | "last" | "custom",
  rawFrom: string | undefined,
  rawTo: string | undefined,
  tz: string
): { range: Range; from: string; to: string } {
  if (period === "last") {
    const r = lastMonth(tz);
    return { range: r, from: defaultDateInput(r.start, tz), to: defaultDateInput(r.end, tz) };
  }
  if (period === "custom") {
    const fromIso = rawFrom ?? defaultDateInput(currentMonth(tz).start, tz);
    const toIso = rawTo ?? defaultDateInput(currentMonth(tz).end, tz);
    const range = customRange(fromIso, toIso, tz) ?? currentMonth(tz);
    return { range, from: fromIso, to: toIso };
  }
  const r = currentMonth(tz);
  return { range: r, from: defaultDateInput(r.start, tz), to: defaultDateInput(r.end, tz) };
}

export default async function MoneyPage({
  searchParams
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      timezone: true,
      cashFlowHorizonDays: true,
      cashFlowTightThresholdCents: true,
      cashFlowIncludeDiscretionary: true,
      cashFlowDiscretionaryDailyCents: true
    }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const currency = env.DEFAULT_CURRENCY;

  const tab = readTab(searchParams.tab);
  const period = readPeriod(searchParams.period);
  const type = readType(searchParams.type);
  const { range, from, to } = resolveRange(period, searchParams.from, searchParams.to, tz);
  const month = currentMonth(tz);

  const selectedCategoryNames = (searchParams.categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [
    activeCategories,
    allCategories,
    transactions,
    breakdown,
    budgets,
    bills,
    subscriptions,
    goals,
    incomeSources,
    incomeMonth,
    financialAccounts,
    networth,
    history,
    startOfMonthNet,
    allSnapshots,
    allHoldings
  ] = await Promise.all([
    listCategories(session.user.id, { includeArchived: false }),
    listCategories(session.user.id, { includeArchived: true }),
    listTransactions(session.user.id, {
      from: range.start,
      to: range.end,
      categoryNames: selectedCategoryNames.length > 0 ? selectedCategoryNames : undefined,
      type
    }),
    monthlyBreakdown(session.user.id, tz),
    listBudgets(session.user.id, tz),
    listBills(session.user.id, tz),
    listSubscriptions(session.user.id),
    listGoals(session.user.id, { includeArchived: true }),
    listIncomeSources(session.user.id, { includeArchived: true }),
    monthlyIncomeSummary(session.user.id, month.start, month.end),
    listFinancialAccounts(session.user.id, { includeArchived: true }),
    calculateNetWorth(session.user.id),
    netWorthHistory(session.user.id),
    netWorthAtDate(session.user.id, month.start),
    prisma.balanceSnapshot.findMany({
      where: { account: { userId: session.user.id } },
      orderBy: { takenAt: "desc" },
      select: {
        id: true,
        accountId: true,
        balanceCents: true,
        takenAt: true,
        note: true
      }
    }),
    listAllHoldings(session.user.id)
  ]);

  const deltaThisMonthCents =
    startOfMonthNet === null ? 0 : networth.totalCents - startOfMonthNet;

  // Cash flow forecast inputs (4K)
  const horizonDays = user?.cashFlowHorizonDays ?? 30;
  const thresholdCents = user?.cashFlowTightThresholdCents ?? 10000;
  const includeDiscretionary = user?.cashFlowIncludeDiscretionary ?? true;
  const cashFlowAccounts = financialAccounts.filter(
    (a) => !a.archived && a.includeInCashFlow
  );
  const startingBalanceCents = cashFlowAccounts.reduce(
    (s, a) => s + (a.isLiability ? -a.balanceCents : a.balanceCents),
    0
  );
  const discretionaryAuto = await computeDiscretionaryDaily(session.user.id, 60);
  const discretionaryDailyCents =
    user?.cashFlowDiscretionaryDailyCents ?? discretionaryAuto.cents;
  const forecast = await buildForecastWithThreshold({
    userId: session.user.id,
    horizonDays,
    startingBalanceCents,
    includeDiscretionary,
    discretionaryDailyCents: includeDiscretionary ? discretionaryDailyCents : 0,
    tightThresholdCents: thresholdCents,
    tz
  });
  const hasIncome = incomeSources.some((s) => s.active);
  const hasOutflows =
    bills.length > 0 ||
    subscriptions.length > 0 ||
    forecast.events.some(
      (e) => e.kind === "loan_payment" || e.kind === "credit_payment"
    );

  // Categories without an active budget — used by the budget-form picker.
  const budgetedNames = new Set(budgets.map((b) => b.name));
  const budgetCandidates = activeCategories
    .filter((c) => !budgetedNames.has(c.name))
    .map((c) => ({ id: c.id, name: c.name, color: c.color }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Money</h1>
        <p className="text-sm text-muted-foreground">
          Spending, budgets, bills, goals — kept honest by being visible.
        </p>
      </div>

      <MoneyTabs
        defaultTab={tab}
        spending={
          <SpendingTab
            categories={activeCategories}
            allCategories={allCategories}
            transactions={transactions}
            breakdown={breakdown}
            currency={currency}
            period={period}
            from={from}
            to={to}
            selectedCategoryNames={selectedCategoryNames}
            type={type}
            incomeMonthCount={incomeMonth.count}
            incomeMonthTotalCents={incomeMonth.totalCents}
          />
        }
        budgets={
          <BudgetsTab
            budgets={budgets}
            candidates={budgetCandidates}
            currency={currency}
          />
        }
        bills={
          <BillsAndSubsTab
            bills={bills}
            subscriptions={subscriptions}
            categories={activeCategories}
            currency={currency}
          />
        }
        income={<IncomeTab sources={incomeSources} currency={currency} />}
        goals={<GoalsTab goals={goals} currency={currency} />}
        cashflow={
          <CashFlowTab
            forecast={forecast}
            accounts={financialAccounts}
            startingBalanceCents={startingBalanceCents}
            cashFlowAccountCount={cashFlowAccounts.length}
            horizonDays={horizonDays}
            thresholdCents={thresholdCents}
            includeDiscretionary={includeDiscretionary}
            discretionaryAuto={discretionaryAuto}
            hasIncome={hasIncome}
            hasOutflows={hasOutflows}
            currency={currency}
          />
        }
        networth={
          <NetworthTab
            accounts={financialAccounts}
            snapshots={allSnapshots}
            holdings={allHoldings}
            history={history}
            totalCents={networth.totalCents}
            assetCents={networth.assetCents}
            liabilityCents={networth.liabilityCents}
            deltaThisMonthCents={deltaThisMonthCents}
            currency={currency}
            timezone={tz}
          />
        }
      />
    </div>
  );
}
