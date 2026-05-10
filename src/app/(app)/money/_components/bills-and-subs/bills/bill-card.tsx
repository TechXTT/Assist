"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Check, Pencil } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/money/format";
import { markBillPaid } from "@/app/(app)/money/actions";
import { BillForm } from "@/app/(app)/money/_components/bills-and-subs/bills/bill-form";
import { DeleteBillDialog } from "@/app/(app)/money/_components/bills-and-subs/bills/delete-bill-dialog";
import type { BillRow } from "@/lib/money/bill-queries";
import type { CategoryRow } from "@/lib/money/category-queries";

const DAY = 24 * 60 * 60 * 1000;

function dueLabel(due: Date | null, recurring: boolean): { text: string; tone: "fine" | "soon" | "due" | "overdue" | "done" } {
  if (!due) return { text: recurring ? "No schedule" : "Paid", tone: "done" };
  const diff = due.getTime() - Date.now();
  const days = Math.round(diff / DAY);
  if (diff < 0) {
    const overdue = Math.abs(days);
    return {
      text: `overdue ${overdue} ${overdue === 1 ? "day" : "days"}`,
      tone: "overdue"
    };
  }
  if (days <= 3) return { text: `due in ${days} ${days === 1 ? "day" : "days"}`, tone: "due" };
  if (days <= 7) return { text: `due in ${days} days`, tone: "soon" };
  return { text: `due in ${days} days`, tone: "fine" };
}

const TONE_TEXT: Record<"fine" | "soon" | "due" | "overdue" | "done", string> = {
  fine: "text-muted-foreground",
  soon: "text-amber-700 dark:text-amber-400",
  due: "text-orange-700 dark:text-orange-400",
  overdue: "text-red-700 dark:text-red-400 font-medium",
  done: "text-emerald-700 dark:text-emerald-400"
};

export function BillCard({
  bill,
  categoryColorByName,
  currency,
  categories
}: {
  bill: BillRow;
  categoryColorByName: Map<string, string>;
  currency: string;
  categories: CategoryRow[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const due = dueLabel(bill.nextDueAt, bill.recurring);
  const color = bill.category ? categoryColorByName.get(bill.category) ?? "#a8a29e" : "#a8a29e";

  function onMarkPaid() {
    start(async () => {
      try {
        await markBillPaid(bill.id);
        toast.success(bill.recurring ? "Marked paid. Next cycle is set." : "Marked paid. Done.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't mark paid.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-medium">{bill.name}</h3>
              <span className="shrink-0 text-sm tabular-nums">
                {formatCents(bill.amountCents, currency)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              <span className={TONE_TEXT[due.tone]}>{due.text}</span>
              {bill.nextDueAt && (
                <span className="text-muted-foreground">
                  · {format(bill.nextDueAt, "EEE d MMM")}
                </span>
              )}
              <span className="text-muted-foreground">
                · {bill.recurring ? "monthly" : "one-off"}
              </span>
              {bill.category && (
                <span className="text-muted-foreground">· {bill.category}</span>
              )}
            </div>
            {bill.notes && (
              <p className="mt-1 text-xs italic text-muted-foreground">{bill.notes}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onMarkPaid}
            disabled={pending || !bill.nextDueAt}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {pending ? "Marking…" : "Mark paid"}
          </Button>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${bill.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <DeleteBillDialog billId={bill.id} name={bill.name} />
          </div>
        </div>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit bill — {bill.name}</DialogTitle>
            <DialogDescription>Tweak any field below.</DialogDescription>
          </DialogHeader>
          <BillForm
            mode="edit"
            categories={categories}
            currency={currency}
            billId={bill.id}
            defaultValues={{
              name: bill.name,
              amount: (bill.amountCents / 100).toString(),
              category: bill.category ?? "",
              recurring: bill.recurring,
              dueDay: bill.dueDay ? String(bill.dueDay) : "",
              dueDate: bill.dueDate ? format(bill.dueDate, "yyyy-MM-dd") : "",
              reminderEnabled: bill.reminderEnabled,
              notes: bill.notes ?? ""
            }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
