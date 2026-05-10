import { AddHoldingButton } from "@/app/(app)/money/_components/networth/holdings/add-holding-button";
import { HoldingRow } from "@/app/(app)/money/_components/networth/holdings/holding-row";
import type { HoldingRow as HoldingRowData } from "@/lib/money/holding-queries";

export function HoldingsList({
  accountId,
  accountType,
  holdings,
  currency
}: {
  accountId: string;
  accountType: "investment" | "crypto";
  holdings: HoldingRowData[];
  currency: string;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-2">
      {holdings.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">
          No holdings yet — add a position to get started.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {holdings.map((h) => (
            <li key={h.id}>
              <HoldingRow holding={h} accountType={accountType} currency={currency} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex justify-end pt-1">
        <AddHoldingButton accountId={accountId} accountType={accountType} />
      </div>
    </div>
  );
}
