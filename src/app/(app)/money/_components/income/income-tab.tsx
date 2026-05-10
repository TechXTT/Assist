"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { AddIncomeSourceButton } from "@/app/(app)/money/_components/income/add-income-source-button";
import { IncomeList } from "@/app/(app)/money/_components/income/income-list";
import type { IncomeSourceRow } from "@/lib/money/income-queries";

export function IncomeTab({
  sources,
  currency
}: {
  sources: IncomeSourceRow[];
  currency: string;
}) {
  const [showArchived, setShowArchived] = useState(false);

  const active = sources.filter((s) => s.active);
  const archived = sources.filter((s) => !s.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length === 0
            ? "Track expected inflows so the dashboard nets correctly."
            : `${active.length} active source${active.length === 1 ? "" : "s"}.`}
        </p>
        <AddIncomeSourceButton currency={currency} />
      </div>

      {active.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No income sources yet — add one to track expected inflows.
          </p>
        </div>
      ) : (
        <IncomeList sources={active} currency={currency} />
      )}

      {archived.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Switch
              id="income-show-archived"
              checked={showArchived}
              onCheckedChange={setShowArchived}
            />
            <label
              htmlFor="income-show-archived"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              View archived ({archived.length})
            </label>
          </div>
          {showArchived && <IncomeList sources={archived} currency={currency} />}
        </div>
      )}
    </div>
  );
}
