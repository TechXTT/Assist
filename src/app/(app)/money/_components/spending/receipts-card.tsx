"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Mail, RefreshCw, Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCents, parseCentsInput } from "@/lib/money/format";
import {
  scanReceiptsAction,
  approveDraftAction,
  rejectDraftAction
} from "@/app/(app)/money/actions";
import type { CategoryRow } from "@/lib/money/category-queries";

export type ReceiptDraftRow = {
  id: string;
  snippet: string;
  parsedAmountCents: number | null;
  parsedCurrency: string | null;
  parsedDate: Date | null;
  parsedMerchant: string | null;
  suggestedCategory: string | null;
};

export function ReceiptsCard({
  drafts,
  categories,
  currency
}: {
  drafts: ReceiptDraftRow[];
  categories: CategoryRow[];
  currency: string;
}) {
  const [scanning, setScanning] = useState(false);
  const [open, setOpen] = useState(drafts.length > 0);

  async function handleScan() {
    setScanning(true);
    try {
      const result = await scanReceiptsAction({ days: 7 });
      const bits: string[] = [];
      bits.push(`${result.draftsCreated} new`);
      if (result.skippedAlreadyKnown > 0) bits.push(`${result.skippedAlreadyKnown} known`);
      if (result.skippedNotReceipt > 0) bits.push(`${result.skippedNotReceipt} non-receipts`);
      const summary = `Scanned ${result.scanned} message${result.scanned === 1 ? "" : "s"}: ${bits.join(", ")}.`;
      if (result.capHit) {
        toast.warning(`${summary} AI cap reached — re-run later.`);
      } else if (result.draftsCreated > 0) {
        toast.success(summary);
        setOpen(true);
      } else {
        toast.message(summary);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed.";
      toast.error(msg);
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className="rounded-md border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Receipts from Gmail</h3>
          {drafts.length > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs">
              {drafts.length} pending
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {drafts.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? "Hide" : "Show drafts"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleScan}
            disabled={scanning}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning…" : "Scan last 7 days"}
          </Button>
        </div>
      </header>

      {open && drafts.length > 0 && (
        <ul className="divide-y border-t">
          {drafts.map((d) => (
            <DraftRow key={d.id} draft={d} categories={categories} fallbackCurrency={currency} />
          ))}
        </ul>
      )}

      {drafts.length === 0 && (
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">
          No drafts pending. Scan to look for new receipts in your inbox.
        </p>
      )}
    </section>
  );
}

function DraftRow({
  draft,
  categories,
  fallbackCurrency
}: {
  draft: ReceiptDraftRow;
  categories: CategoryRow[];
  fallbackCurrency: string;
}) {
  const initialAmount =
    draft.parsedAmountCents !== null ? (draft.parsedAmountCents / 100).toFixed(2) : "";
  const initialDate = draft.parsedDate
    ? format(draft.parsedDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const initialDescription = draft.parsedMerchant ?? draft.snippet.slice(0, 60);

  const [amount, setAmount] = useState(initialAmount);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState(draft.suggestedCategory ?? "");
  const [occurredAt, setOccurredAt] = useState(initialDate);
  const [pending, startTransition] = useTransition();

  function handleApprove() {
    const cents = parseCentsInput(amount);
    if (cents === null) {
      toast.error("Amount doesn't look like a number.");
      return;
    }
    startTransition(async () => {
      try {
        await approveDraftAction(draft.id, {
          amountCents: -Math.abs(cents),
          currency: draft.parsedCurrency ?? fallbackCurrency,
          description: description.trim() || draft.snippet.slice(0, 60),
          category: category.trim() || null,
          occurredAt
        });
        toast.success("Saved as a transaction.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Couldn't save.";
        toast.error(msg);
      }
    });
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectDraftAction(draft.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Couldn't dismiss.";
        toast.error(msg);
      }
    });
  }

  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <p className="line-clamp-2 text-xs text-muted-foreground">{draft.snippet}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Input
          aria-label="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
        <Input
          aria-label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="sm:col-span-2"
        />
        <Input
          aria-label="Category"
          list={`receipt-cats-${draft.id}`}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category"
        />
        <datalist id={`receipt-cats-${draft.id}`}>
          {categories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <Input
          aria-label="Date"
          type="date"
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs tabular-nums text-muted-foreground">
          {draft.parsedAmountCents !== null
            ? formatCents(-Math.abs(draft.parsedAmountCents), draft.parsedCurrency ?? fallbackCurrency)
            : "—"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleReject}
            disabled={pending}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleApprove}
            disabled={pending}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
        </div>
      </div>
    </li>
  );
}
