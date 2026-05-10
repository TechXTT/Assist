"use client";

import { useMemo, useState } from "react";

import { AddTransactionButton } from "@/app/(app)/money/_components/spending/add-transaction-button";
import { ManageCategoriesSheet } from "@/app/(app)/money/_components/spending/manage-categories-sheet";
import { MonthlyBreakdown } from "@/app/(app)/money/_components/spending/monthly-breakdown";
import { TransactionDetailSheet } from "@/app/(app)/money/_components/spending/transaction-detail-sheet";
import {
  TransactionFilters
} from "@/app/(app)/money/_components/spending/transaction-filters";
import { TransactionsList } from "@/app/(app)/money/_components/spending/transactions-list";
import type { CategoryRow } from "@/lib/money/category-queries";
import type { CategoryBreakdown, TransactionRow } from "@/lib/money/transaction-queries";

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
  selectedCategoryNames
}: {
  categories: CategoryRow[]; // active only — used in form pickers + filter
  allCategories: CategoryRow[]; // including archived — used in manage sheet
  transactions: TransactionRow[];
  breakdown: CategoryBreakdown;
  currency: string;
  period: Period;
  from: string;
  to: string;
  selectedCategoryNames: string[];
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
    (selectedCategoryNames.length > 0 || period !== "this");

  const emptyCopy = isFilteredEmpty
    ? "Nothing matches that filter."
    : "No transactions yet — log one when you've got a sec.";

  return (
    <div className="space-y-6">
      <MonthlyBreakdown
        total={breakdown.total}
        rows={breakdown.byCategory}
        currency={currency}
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <TransactionFilters
          period={period}
          from={from}
          to={to}
          selectedCategoryNames={selectedCategoryNames}
          categories={categories}
        />
        <div className="flex items-center gap-2">
          <ManageCategoriesSheet categories={allCategories} />
          <AddTransactionButton categories={categories} currency={currency} />
        </div>
      </div>

      <TransactionsList
        transactions={transactions}
        currency={currency}
        onSelect={setSelectedId}
        emptyCopy={emptyCopy}
        categoryColorByName={colorByName}
      />

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
