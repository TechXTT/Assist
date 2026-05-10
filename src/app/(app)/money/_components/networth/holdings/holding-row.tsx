"use client";

import { useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { formatCents } from "@/lib/money/format";
import { positionGainLoss, positionValue } from "@/lib/money/investments";
import { DeleteHoldingDialog } from "@/app/(app)/money/_components/networth/holdings/delete-holding-dialog";
import { HoldingForm } from "@/app/(app)/money/_components/networth/holdings/holding-form";
import { UpdatePriceDialog } from "@/app/(app)/money/_components/networth/holdings/update-price-dialog";
import type { HoldingRow as HoldingRowData } from "@/lib/money/holding-queries";

function formatShares(shares: string): string {
  const n = Number.parseFloat(shares);
  if (!Number.isFinite(n)) return shares;
  // Strip trailing zeros while keeping up to 6 fractional digits for legibility.
  const fixed = n.toFixed(6);
  return fixed.replace(/\.?0+$/, "") || "0";
}

export function HoldingRow({
  holding,
  accountType,
  currency
}: {
  holding: HoldingRowData;
  accountType: "investment" | "crypto";
  currency: string;
}) {
  const [pricing, setPricing] = useState(false);
  const [editing, setEditing] = useState(false);

  const value = positionValue(holding);
  const gainLoss = positionGainLoss(holding);

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-md border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-medium">{holding.ticker}</span>
          {holding.name && (
            <span className="truncate text-xs text-muted-foreground">— {holding.name}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatShares(holding.shares)} ×{" "}
          {formatCents(holding.lastKnownPriceCents, currency)}
        </div>
      </div>

      <div className="text-right">
        <div className="text-sm tabular-nums">{formatCents(value, currency)}</div>
        {gainLoss && (
          <div
            className={cn(
              "text-xs tabular-nums",
              gainLoss.absoluteCents > 0 && "text-emerald-600 dark:text-emerald-400",
              gainLoss.absoluteCents < 0 && "text-amber-700 dark:text-amber-400",
              gainLoss.absoluteCents === 0 && "text-muted-foreground"
            )}
          >
            {gainLoss.absoluteCents > 0 ? "+" : ""}
            {formatCents(gainLoss.absoluteCents, currency)} ·{" "}
            {gainLoss.absoluteCents > 0 ? "+" : ""}
            {(gainLoss.ratio * 100).toFixed(1)}%
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setPricing(true)}
          aria-label={`Update ${holding.ticker} price`}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setEditing(true)}
          aria-label={`Edit ${holding.ticker}`}
        >
          <Pencil className="h-3 w-3" />
        </Button>
        <DeleteHoldingDialog holdingId={holding.id} ticker={holding.ticker} />
      </div>

      <UpdatePriceDialog
        open={pricing}
        onOpenChange={setPricing}
        holdingId={holding.id}
        ticker={holding.ticker}
        currentPriceCents={holding.lastKnownPriceCents}
        currency={currency}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit holding — {holding.ticker}</DialogTitle>
          </DialogHeader>
          <HoldingForm
            mode="edit"
            accountType={accountType}
            holdingId={holding.id}
            defaultValues={{
              ticker: holding.ticker,
              name: holding.name ?? "",
              shares: formatShares(holding.shares),
              avgCost:
                holding.avgCostCents === null ? "" : (holding.avgCostCents / 100).toString(),
              price: (holding.lastKnownPriceCents / 100).toString(),
              lastPriceUpdate: ""
            }}
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
