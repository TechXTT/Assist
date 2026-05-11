"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCents } from "@/lib/money/format";
import { AddTransactionButton } from "@/app/(app)/money/_components/spending/add-transaction-button";
import { ManageCategoriesSheet } from "@/app/(app)/money/_components/spending/manage-categories-sheet";
import { MonthlyBreakdown } from "@/app/(app)/money/_components/spending/monthly-breakdown";
import { TransactionDetailSheet } from "@/app/(app)/money/_components/spending/transaction-detail-sheet";
import {
  TransactionFilters
} from "@/app/(app)/money/_components/spending/transaction-filters";
import { TransactionsList } from "@/app/(app)/money/_components/spending/transactions-list";
import {
  ReceiptsCard,
  type ReceiptDraftRow
} from "@/app/(app)/money/_components/spending/receipts-card";
import type { CategoryRow } from "@/lib/money/category-queries";
import type {
  CategoryBreakdown,
  TransactionRow,
  TransactionTypeFilter
} from "@/lib/money/transaction-queries";

type Period = "this" | "last" | "custom";

export function SpendingTab({
  categories,
  allCategories,
  transactions,
  breakdown,
  currency,
  period,
  from,
  to,
  selectedCategoryNames,
  type,
  incomeMonthCount,
  incomeMonthTotalCents,
  receiptDrafts
}: {
  categories: CategoryRow[];
  allCategories: CategoryRow[];
  transactions: TransactionRow[];
  breakdown: CategoryBreakdown;
  currency: string;
  period: Period;
  from: string;
  to: string;
  selectedCategoryNames: string[];
  type: TransactionTypeFilter;
  incomeMonthCount: number;
  incomeMonthTotalCents: number;
  receiptDrafts: ReceiptDraftRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detail = useMemo(() => {
    if (!selectedId) return null;
    return transactions.find((t) => t.id === selectedId) ?? null;
  }, [selectedId, transactions]);

  const colorByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.name, c.color);
    return map;
  }, [categories]);

  const isFilteredEmpty =
    transactions.length === 0 &&
    (selectedCategoryNames.length > 0 || period !== "this" || type !== "expenses");

  const emptyCopy = isFilteredEmpty
    ? "Nothing matches that filter."
    : type === "income"
      ? "No income logged yet this period."
      : "No transactions yet — log one when you've got a sec.";

  return (
    <div className="space-y-6">
      {type === "income" ? (
        <div className="rounded-md border bg-card px-4 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">Received this month:</span>{" "}
            <span className="font-medium tabular-nums">
              {formatCents(incomeMonthTotalCents, currency)}
            </span>{" "}
            <span className="text-xs text-muted-foreground">
              ({incomeMonthCount} {incomeMonthCount === 1 ? "transaction" : "transactions"})
            </span>
          </p>
        </div>
      ) : (
        <MonthlyBreakdown
          total={breakdown.total}
          rows={breakdown.byCategory}
          currency={currency}
        />
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <TransactionFilters
          period={period}
          from={from}
          to={to}
          selectedCategoryNames={selectedCategoryNames}
          categories={categories}
          type={type}
        />
        <div className="flex items-center gap-2">
          <ManageCategoriesSheet categories={allCategories} />
          <AddTransactionButton categories={categories} currency={currency} />
        </div>
      </div>

      {type === "expenses" && incomeMonthCount > 0 && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          You also have {incomeMonthCount} income {incomeMonthCount === 1 ? "transaction" : "transactions"}{" "}
          this month —{" "}
          <Link href="/money?type=income" className="underline-offset-2 hover:underline">
            switch to Income view
          </Link>
          .
        </p>
      )}

      <TransactionsList
        transactions={transactions}
        currency={currency}
        onSelect={setSelectedId}
        emptyCopy={emptyCopy}
        categoryColorByName={colorByName}
      />

      {type !== "income" && (
        <ReceiptsCard
          drafts={receiptDrafts}
          categories={categories}
          currency={currency}
        />
      )}

      <TransactionDetailSheet
        transaction={detail}
        categories={categories}
        currency={currency}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </div>
  );
}
