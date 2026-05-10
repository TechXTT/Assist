"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money/format";
import { setCashFlowHorizon } from "@/app/(app)/money/actions";
import { CashFlowAccountsSheet } from "@/app/(app)/money/_components/cashflow/cash-flow-accounts-sheet";
import { ThresholdInput } from "@/app/(app)/money/_components/cashflow/threshold-input";
import type { FinancialAccountRow } from "@/lib/money/account-queries";

type Horizon = 30 | 60 | 90;
const HORIZONS: Horizon[] = [30, 60, 90];

export function CashFlowSummaryRow({
  startingBalanceCents,
  cashFlowAccountCount,
  horizonDays,
  thresholdCents,
  accounts,
  currency
}: {
  startingBalanceCents: number;
  cashFlowAccountCount: number;
  horizonDays: number;
  thresholdCents: number;
  accounts: FinancialAccountRow[];
  currency: string;
}) {
  const [pending, start] = useTransition();

  function setHorizon(days: Horizon) {
    if (days === horizonDays) return;
    start(async () => {
      try {
        await setCashFlowHorizon(days);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums">
            {formatCents(startingBalanceCents, currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            across {cashFlowAccountCount} cash flow {cashFlowAccountCount === 1 ? "account" : "accounts"}
            <span> · </span>
            <CashFlowAccountsSheet accounts={accounts} currency={currency} />
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                disabled={pending}
                className={cn(
                  "rounded px-3 py-1 text-xs font-medium transition-colors",
                  horizonDays === h
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {h}d
              </button>
            ))}
          </div>
          <ThresholdInput thresholdCents={thresholdCents} currency={currency} />
        </div>
      </div>
    </div>
  );
}
