"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { AddGoalButton } from "@/app/(app)/money/_components/goals/add-goal-button";
import { GoalCard } from "@/app/(app)/money/_components/goals/goal-card";
import type { GoalRow } from "@/lib/money/goal-queries";

export function GoalsTab({
  goals,
  currency
}: {
  goals: GoalRow[];
  currency: string;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const visible = showArchived ? goals : goals.filter((g) => !g.archived);
  const hasArchived = goals.some((g) => g.archived);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {visible.length === 0 && !showArchived
            ? "Pick something and chip away at it."
            : `${visible.filter((g) => !g.archived).length} active${
                hasArchived && showArchived
                  ? `, ${goals.filter((g) => g.archived).length} archived`
                  : ""
              }.`}
        </p>
        <AddGoalButton />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No goals yet. Pick something and chip away at it.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((g) => (
            <GoalCard key={g.id} goal={g} currency={currency} />
          ))}
        </div>
      )}

      {hasArchived && (
        <div className="flex items-center gap-2 pt-2">
          <Switch
            id="goals-show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
          />
          <label
            htmlFor="goals-show-archived"
            className="cursor-pointer text-xs text-muted-foreground"
          >
            View archived
          </label>
        </div>
      )}
    </div>
  );
}
