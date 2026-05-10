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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCents } from "@/lib/money/format";
import {
  daysUntilNext,
  shouldShowCancelHint
} from "@/lib/money/subscription-utils";
import {
  markSubscriptionCharged,
  setSubscriptionUnused
} from "@/app/(app)/money/actions";
import { CancelHint } from "@/app/(app)/money/_components/bills-and-subs/subs/cancel-hint";
import { DeleteSubDialog } from "@/app/(app)/money/_components/bills-and-subs/subs/delete-sub-dialog";
import { SubForm } from "@/app/(app)/money/_components/bills-and-subs/subs/sub-form";
import type { SubscriptionRow } from "@/lib/money/subscription-queries";
import type { CategoryRow } from "@/lib/money/category-queries";

export function SubCard({
  sub,
  currency,
  categoryColorByName,
  categories
}: {
  sub: SubscriptionRow;
  currency: string;
  categoryColorByName: Map<string, string>;
  categories: CategoryRow[];
}) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  const days = daysUntilNext(sub.nextChargeAt);
  const showHint = shouldShowCancelHint(sub);
  const color = sub.category ? categoryColorByName.get(sub.category) ?? "#a8a29e" : "#a8a29e";

  function onMarkCharged() {
    start(async () => {
      try {
        await markSubscriptionCharged(sub.id);
        toast.success("Cycle advanced.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  function onToggleUnused(next: boolean) {
    start(async () => {
      try {
        await setSubscriptionUnused(sub.id, next);
        if (next) {
          toast.success("Noted. We'll surface a cancel hint next time you visit.");
        } else {
          toast.success("Got it — keeping it around.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
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
              <h3 className="truncate text-sm font-medium">{sub.name}</h3>
              <span className="shrink-0 text-sm tabular-nums">
                {formatCents(sub.amountCents, currency)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>billed {sub.billingCycle}</span>
              <span>·</span>
              <span
                className={cn(
                  days < 0 && "text-red-700 dark:text-red-400",
                  days >= 0 && days <= 3 && "text-orange-700 dark:text-orange-400"
                )}
              >
                {days < 0
                  ? `overdue ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`
                  : `next charge in ${days} ${days === 1 ? "day" : "days"}`}
              </span>
              <span>· {format(sub.nextChargeAt, "EEE d MMM")}</span>
              {sub.category && <span>· {sub.category}</span>}
            </div>
          </div>
        </div>

        {showHint && <CancelHint subId={sub.id} name={sub.name} />}

        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-2">
            <Switch
              id={`unused-${sub.id}`}
              checked={sub.userMarkedUnused}
              onCheckedChange={onToggleUnused}
              disabled={pending}
            />
            <Label htmlFor={`unused-${sub.id}`} className="cursor-pointer text-xs text-muted-foreground">
              I haven&apos;t been using this
            </Label>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onMarkCharged}
              disabled={pending}
              className="gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Mark charged
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${sub.name}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <DeleteSubDialog subId={sub.id} name={sub.name} />
          </div>
        </div>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subscription — {sub.name}</DialogTitle>
            <DialogDescription>Tweak any field below.</DialogDescription>
          </DialogHeader>
          <SubForm
            mode="edit"
            categories={categories}
            currency={currency}
            subId={sub.id}
            defaultValues={{
              name: sub.name,
              amount: (sub.amountCents / 100).toString(),
              billingCycle: (sub.billingCycle === "annual" ? "annual" : "monthly") as
                | "monthly"
                | "annual",
              nextChargeAt: format(sub.nextChargeAt, "yyyy-MM-dd"),
              category: sub.category ?? ""
            }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
