"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ArchiveRestore, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCents, parseCentsInput } from "@/lib/money/format";
import { progressPct, projectedCompletion } from "@/lib/money/goals";
import { addToGoal, unarchiveGoal } from "@/app/(app)/money/actions";
import { ArchiveGoalDialog } from "@/app/(app)/money/_components/goals/archive-goal-dialog";
import { GoalForm } from "@/app/(app)/money/_components/goals/goal-form";
import type { GoalRow } from "@/lib/money/goal-queries";

function projectionCopy(goal: GoalRow, currency: string): string {
  const projection = projectedCompletion(goal, currency);
  switch (projection.state) {
    case "completed":
      return "Done — nice job.";
    case "no-rate":
      return "Project once you've saved something.";
    case "too-early":
      return "Too early to project — log a few more saves.";
    case "on-track":
    case "behind-target":
      return projection.copy;
  }
}

export function GoalCard({ goal, currency }: { goal: GoalRow; currency: string }) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const pct = progressPct(goal);
  const completed = goal.savedCents >= goal.targetCents;

  return (
    <Card className={cn(goal.archived && "opacity-70")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium">{goal.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCents(goal.savedCents, currency)} of {formatCents(goal.targetCents, currency)}
              {goal.targetDate && (
                <>
                  {" "}
                  · target {format(goal.targetDate, "d MMM yyyy")}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${goal.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {goal.archived ? (
              <UnarchiveButton goalId={goal.id} />
            ) : (
              <ArchiveGoalDialog goalId={goal.id} name={goal.name} />
            )}
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", completed ? "bg-emerald-500" : "bg-foreground/70")}
            style={{ width: `${pct}%` }}
          />
        </div>

        <p className="text-xs text-muted-foreground">{projectionCopy(goal, currency)}</p>

        {goal.notes && <p className="text-xs italic text-muted-foreground">{goal.notes}</p>}

        {!goal.archived && (
          <>
            {adding ? (
              <AddSavingsInline
                goalId={goal.id}
                onClose={() => setAdding(false)}
                currency={currency}
              />
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAdding(true)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />I saved…
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit goal — {goal.name}</DialogTitle>
          </DialogHeader>
          <GoalForm
            mode="edit"
            goalId={goal.id}
            defaultValues={{
              name: goal.name,
              target: (goal.targetCents / 100).toString(),
              targetDate: goal.targetDate ? format(goal.targetDate, "yyyy-MM-dd") : "",
              notes: goal.notes ?? ""
            }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AddSavingsInline({
  goalId,
  onClose,
  currency
}: {
  goalId: string;
  onClose: () => void;
  currency: string;
}) {
  const [value, setValue] = useState("");
  const [pending, start] = useTransition();

  function submit() {
    const cents = parseCentsInput(value);
    if (!cents || cents <= 0) {
      toast.error("Save more than zero.");
      return;
    }
    start(async () => {
      try {
        await addToGoal(goalId, cents);
        toast.success(`+ ${formatCents(cents, currency)} saved.`);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="50"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") onClose();
        }}
        className="h-9"
      />
      <Button type="button" size="sm" onClick={submit} disabled={pending}>
        Add
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={pending}>
        Cancel
      </Button>
    </div>
  );
}

function UnarchiveButton({ goalId }: { goalId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-muted-foreground"
      disabled={pending}
      aria-label="Restore"
      onClick={() => {
        start(async () => {
          try {
            await unarchiveGoal(goalId);
            toast.success("Restored.");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't restore.");
          }
        });
      }}
    >
      <ArchiveRestore className="h-3.5 w-3.5" />
    </Button>
  );
}
