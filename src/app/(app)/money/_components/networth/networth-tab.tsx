"use client";

import { useMemo, useState } from "react";

import { AccountList } from "@/app/(app)/money/_components/networth/account-list";
import { AddAccountButton } from "@/app/(app)/money/_components/networth/add-account-button";
import {
  CompositionDonut,
  type CompositionRow
} from "@/app/(app)/money/_components/networth/composition-donut";
import {
  NetworthChart,
  type ChartPoint
} from "@/app/(app)/money/_components/networth/networth-chart";
import { NetworthSummaryCard } from "@/app/(app)/money/_components/networth/networth-summary-card";
import type { FinancialAccountRow } from "@/lib/money/account-queries";
import type { SnapshotHistoryRow } from "@/app/(app)/money/_components/networth/snapshot-history-sheet";

export function NetworthTab({
  accounts,
  snapshots,
  history,
  totalCents,
  assetCents,
  liabilityCents,
  deltaThisMonthCents,
  currency
}: {
  accounts: FinancialAccountRow[];
  snapshots: SnapshotHistoryRow[]; // all snapshots, will be grouped by accountId
  history: ChartPoint[];
  totalCents: number;
  assetCents: number;
  liabilityCents: number;
  deltaThisMonthCents: number;
  currency: string;
}) {
  const [filterKey, setFilterKey] = useState<string | null>(null);

  const snapshotsByAccount = useMemo(() => {
    const map = new Map<string, SnapshotHistoryRow[]>();
    for (const s of snapshots) {
      const list = map.get(s.accountId) ?? [];
      list.push(s);
      map.set(s.accountId, list);
    }
    return map;
  }, [snapshots]);

  // Composition data: one row per (type, isLiability) combo, sourced from
  // active + included accounts only (matches the headline rule).
  const compositionRows = useMemo<CompositionRow[]>(() => {
    const buckets = new Map<string, CompositionRow>();
    for (const a of accounts) {
      if (a.archived || !a.includeInNetWorth) continue;
      const key = a.isLiability ? `liability:${a.type}` : a.type;
      const existing = buckets.get(key);
      if (existing) {
        existing.amountCents += a.balanceCents;
      } else {
        buckets.set(key, {
          key,
          type: a.type,
          isLiability: a.isLiability,
          amountCents: a.balanceCents
        });
      }
    }
    return Array.from(buckets.values()).sort((a, b) => b.amountCents - a.amountCents);
  }, [accounts]);

  const isEmpty = accounts.filter((a) => !a.archived).length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Net worth across all your accounts. Manual updates only — punch in a number whenever you check.
        </p>
        <AddAccountButton currency={currency} />
      </div>

      {isEmpty ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No accounts yet — add one to start tracking your net worth.
          </p>
        </div>
      ) : (
        <>
          <NetworthSummaryCard
            totalCents={totalCents}
            assetCents={assetCents}
            liabilityCents={liabilityCents}
            deltaThisMonthCents={deltaThisMonthCents}
            currency={currency}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <NetworthChart history={history} currency={currency} />
            <CompositionDonut
              rows={compositionRows}
              selected={filterKey}
              onSelect={setFilterKey}
              currency={currency}
            />
          </div>

          <AccountList
            accounts={accounts}
            snapshotsByAccount={snapshotsByAccount}
            currency={currency}
            filterType={filterKey}
          />
        </>
      )}
    </div>
  );
}
