"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCents } from "@/lib/money/format";
import { TransactionForm } from "@/app/(app)/money/_components/spending/transaction-form";
import { DeleteTransactionDialog } from "@/app/(app)/money/_components/spending/delete-transaction-dialog";
import type { CategoryRow } from "@/lib/money/category-queries";
import type { TransactionRow } from "@/lib/money/transaction-queries";

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function TransactionDetailSheet({
  transaction,
  categories,
  currency,
  onOpenChange
}: {
  transaction: TransactionRow | null;
  categories: CategoryRow[];
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const open = transaction != null;
  const [editing, setEditing] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const side = isDesktop ? "right" : "bottom";
  const sheetClass = isDesktop
    ? "w-full overflow-y-auto sm:max-w-md"
    : "max-h-[85dvh] overflow-y-auto rounded-t-xl";

  function close() {
    setEditing(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent side={side} className={sheetClass}>
        {transaction && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-base">
                {transaction.description || "(no description)"}
              </SheetTitle>
            </SheetHeader>

            {!editing ? (
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div
                    className={
                      transaction.amountCents < 0
                        ? "mt-0.5 text-2xl font-semibold tabular-nums"
                        : "mt-0.5 text-2xl font-semibold tabular-nums text-emerald-600"
                    }
                  >
                    {transaction.amountCents > 0 ? "+" : ""}
                    {formatCents(transaction.amountCents, currency)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">When</div>
                    <div className="mt-0.5">
                      {format(transaction.occurredAt, "EEE d MMM, HH:mm")}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Category</div>
                    <div className="mt-0.5">{transaction.category ?? "—"}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <DeleteTransactionDialog transactionId={transaction.id} onDeleted={close} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <TransactionForm
                  mode="edit"
                  categories={categories}
                  currency={currency}
                  transactionId={transaction.id}
                  defaultValues={{
                    amount: (Math.abs(transaction.amountCents) / 100).toString(),
                    sign: transaction.amountCents < 0 ? "expense" : "income",
                    category: transaction.category ?? "",
                    description: transaction.description ?? "",
                    occurredAt: toLocalInput(transaction.occurredAt)
                  }}
                  onDone={() => setEditing(false)}
                />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
