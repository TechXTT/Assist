"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { AccountCard } from "@/app/(app)/money/_components/networth/account-card";
import type { FinancialAccountRow } from "@/lib/money/account-queries";
import type { SnapshotHistoryRow } from "@/app/(app)/money/_components/networth/snapshot-history-sheet";

export function AccountList({
  accounts,
  snapshotsByAccount,
  currency,
  filterType
}: {
  accounts: FinancialAccountRow[];
  snapshotsByAccount: Map<string, SnapshotHistoryRow[]>;
  currency: string;
  filterType: string | null;
}) {
  const [showArchived, setShowArchived] = useState(false);

  const visibleActive = accounts.filter(
    (a) =>
      !a.archived &&
      (filterType === null ||
        (filterType === "liability" ? a.isLiability : a.type === filterType))
  );
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="space-y-4">
      {visibleActive.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {filterType === null
              ? "No accounts yet — add one to start tracking your net worth."
              : "Nothing matches that slice."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleActive.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              currency={currency}
              snapshots={snapshotsByAccount.get(a.id) ?? []}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Switch
              id="accounts-show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <label
              htmlFor="accounts-show-archived"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              View archived ({archived.length})
            </label>
          </div>
          {showArchived && (
            <div className="grid gap-3 md:grid-cols-2">
              {archived.map((a) => (
                <AccountCard
                  key={a.id}
                  account={a}
                  currency={currency}
                  snapshots={snapshotsByAccount.get(a.id) ?? []}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
