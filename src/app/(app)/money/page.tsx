import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listBudgets } from "@/lib/money/budget-queries";
import { listCategories } from "@/lib/money/category-queries";
import {
  listTransactions,
  monthlyBreakdown
} from "@/lib/money/transaction-queries";
import { currentMonth, customRange, lastMonth, type Range } from "@/lib/money/period";
import {
  MoneyTabs,
  type MoneyTab
} from "@/app/(app)/money/_components/money-tabs";
import { ComingSoon } from "@/app/(app)/money/_components/coming-soon";
import { SpendingTab } from "@/app/(app)/money/_components/spending/spending-tab";
import { BudgetsTab } from "@/app/(app)/money/_components/budgets/budgets-tab";

export const dynamic = "force-dynamic";

type SearchParams = {
  tab?: string;
  period?: string;
  from?: string;
  to?: string;
  categories?: string;
};

function readTab(value: string | undefined): MoneyTab {
  if (value === "budgets" || value === "bills" || value === "goals") return value;
  return "spending";
}

function readPeriod(value: string | undefined): "this" | "last" | "custom" {
  if (value === "last" || value === "custom") return value;
  return "this";
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
    select: { timezone: true }
  });
  const tz = user?.timezone || env.DEFAULT_TIMEZONE;
  const currency = env.DEFAULT_CURRENCY;

  const tab = readTab(searchParams.tab);
  const period = readPeriod(searchParams.period);
  const { range, from, to } = resolveRange(period, searchParams.from, searchParams.to, tz);

  const selectedCategoryNames = (searchParams.categories ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [activeCategories, allCategories, transactions, breakdown, budgets] = await Promise.all([
    listCategories(session.user.id, { includeArchived: false }),
    listCategories(session.user.id, { includeArchived: true }),
    listTransactions(session.user.id, {
      from: range.start,
      to: range.end,
      categoryNames: selectedCategoryNames.length > 0 ? selectedCategoryNames : undefined
    }),
    monthlyBreakdown(session.user.id, tz),
    listBudgets(session.user.id, tz)
  ]);

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
          <ComingSoon
            title="Bills & subscriptions"
            blurb="Track recurring bills with 3-day-out reminders, plus subscriptions with a quiet 'consider canceling?' nudge."
          />
        }
        goals={
          <ComingSoon
            title="Savings goals"
            blurb="Set a target, log saves, watch the bar fill. Projected completion based on your pace."
          />
        }
      />
    </div>
  );
}
