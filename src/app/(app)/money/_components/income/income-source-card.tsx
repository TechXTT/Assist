"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ArchiveRestore, Check, Pencil } from "lucide-react";
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
import { formatCents } from "@/lib/money/format";
import { cadenceLabel } from "@/lib/money/income";
import { unarchiveIncomeSource } from "@/app/(app)/money/actions";
import { ArchiveSourceDialog } from "@/app/(app)/money/_components/income/archive-source-dialog";
import { IncomeSourceForm } from "@/app/(app)/money/_components/income/income-source-form";
import { MarkReceivedDialog } from "@/app/(app)/money/_components/income/mark-received-dialog";
import type { IncomeSourceRow } from "@/lib/money/income-queries";

const DAY = 24 * 60 * 60 * 1000;

function nextLabel(date: Date, now: Date = new Date()): { text: string; tone: "fine" | "soon" | "due" | "overdue" } {
  const diff = date.getTime() - now.getTime();
  const days = Math.round(diff / DAY);
  if (diff < 0) {
    const overdue = Math.abs(days);
    return { text: `overdue ${overdue} ${overdue === 1 ? "day" : "days"}`, tone: "overdue" };
  }
  if (days <= 3) return { text: `in ${days} ${days === 1 ? "day" : "days"}`, tone: "due" };
  if (days <= 7) return { text: `in ${days} days`, tone: "soon" };
  return { text: `in ${days} days`, tone: "fine" };
}

const TONE_TEXT: Record<"fine" | "soon" | "due" | "overdue", string> = {
  fine: "text-muted-foreground",
  soon: "text-amber-700 dark:text-amber-400",
  due: "text-orange-700 dark:text-orange-400",
  overdue: "text-red-700 dark:text-red-400 font-medium"
};

export function IncomeSourceCard({
  source,
  currency
}: {
  source: IncomeSourceRow;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [marking, setMarking] = useState(false);

  if (!source.active) {
    return <ArchivedCard source={source} />;
  }

  const next = nextLabel(source.nextExpectedAt);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-medium">{source.name}</h3>
              <span className="shrink-0 text-sm tabular-nums">
                {formatCents(source.expectedAmountCents, source.currency)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>
                {cadenceLabel(
                  source.cadence,
                  source.cadenceAnchorDay,
                  source.cadence === "oneoff" ? source.nextExpectedAt : null
                )}
              </span>
              <span>·</span>
              <span className={TONE_TEXT[next.tone]}>Next {next.text}</span>
              <span>· {format(source.nextExpectedAt, "EEE d MMM")}</span>
            </div>
            {source.lastReceivedAt && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last received {format(source.lastReceivedAt, "d MMM yyyy")}
              </p>
            )}
            {source.notes && (
              <p className="mt-1 text-xs italic text-muted-foreground">{source.notes}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setMarking(true)}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Mark received
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${source.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <ArchiveSourceDialog sourceId={source.id} name={source.name} />
          </div>
        </div>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit income source — {source.name}</DialogTitle>
          </DialogHeader>
          <IncomeSourceForm
            mode="edit"
            currency={currency}
            sourceId={source.id}
            defaultValues={{
              name: source.name,
              amount: (source.expectedAmountCents / 100).toString(),
              cadence: (source.cadence as "monthly" | "biweekly" | "weekly" | "oneoff") ?? "monthly",
              cadenceAnchorDay: source.cadenceAnchorDay ? String(source.cadenceAnchorDay) : "",
              nextExpectedAt: format(source.nextExpectedAt, "yyyy-MM-dd"),
              category: source.category,
              notes: source.notes ?? ""
            }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>

      <MarkReceivedDialog
        open={marking}
        onOpenChange={setMarking}
        sourceId={source.id}
        sourceName={source.name}
        expectedAmountCents={source.expectedAmountCents}
        currency={source.currency}
        cadence={source.cadence}
      />
    </Card>
  );
}

function ArchivedCard({ source }: { source: IncomeSourceRow }) {
  const [pending, start] = useTransition();
  function unarchive() {
    start(async () => {
      try {
        await unarchiveIncomeSource(source.id);
        toast.success("Restored.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't restore.");
      }
    });
  }

  return (
    <Card className="opacity-70">
      <CardContent className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{source.name}</p>
          <p className="text-xs text-muted-foreground">
            {cadenceLabel(source.cadence, source.cadenceAnchorDay)} ·{" "}
            {formatCents(source.expectedAmountCents, source.currency)}
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn("h-7 w-7 text-muted-foreground", pending && "opacity-50")}
          onClick={unarchive}
          disabled={pending}
          aria-label="Restore"
        >
          <ArchiveRestore className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
