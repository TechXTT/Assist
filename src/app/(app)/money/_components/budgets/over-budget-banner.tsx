"use client";

import { useState } from "react";

import type { BudgetWithProgress } from "@/lib/money/budget-queries";

const COLLAPSE_THRESHOLD = 4;

export function OverBudgetBanner({ hot }: { hot: BudgetWithProgress[] }) {
  const [expanded, setExpanded] = useState(false);
  if (hot.length === 0) return null;

  const collapse = hot.length >= COLLAPSE_THRESHOLD && !expanded;

  return (
    <div className="rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
      {collapse ? (
        <div className="flex items-center justify-between gap-3">
          <span>
            Heads up — {hot.length} budgets running hot.
          </span>
          <button
            type="button"
            className="rounded px-2 py-0.5 text-xs underline-offset-2 hover:underline"
            onClick={() => setExpanded(true)}
          >
            See which
          </button>
        </div>
      ) : (
        <ul className="space-y-1">
          {hot.map((b) => (
            <li key={b.id}>
              Heads up — <span className="font-medium">{b.name}</span> is at {b.percentUsed}% with {b.daysRemaining} {b.daysRemaining === 1 ? "day" : "days"} to go.
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
