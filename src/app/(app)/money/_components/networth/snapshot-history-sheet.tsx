"use client";

import { format } from "date-fns";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCents } from "@/lib/money/format";
import { DeleteSnapshotDialog } from "@/app/(app)/money/_components/networth/delete-snapshot-dialog";

export type SnapshotHistoryRow = {
  id: string;
  accountId: string;
  balanceCents: number;
  takenAt: Date | string;
  note: string | null;
};

export function SnapshotHistorySheet({
  open,
  onOpenChange,
  accountName,
  currency,
  snapshots
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountName: string;
  currency: string;
  snapshots: SnapshotHistoryRow[];
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const side = isDesktop ? "right" : "bottom";
  const sheetClass = isDesktop
    ? "w-full overflow-y-auto sm:max-w-md"
    : "max-h-[85dvh] overflow-y-auto rounded-t-xl";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className={sheetClass}>
        <SheetHeader>
          <SheetTitle>History — {accountName}</SheetTitle>
          <SheetDescription>
            One row per snapshot. Delete a wrong one — past totals don&apos;t shift.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {snapshots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No snapshots yet.</p>
          ) : (
            <ul className="divide-y rounded-md border bg-background">
              {snapshots.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {format(new Date(r.takenAt), "EEE d MMM yyyy")}
                      </span>
                      <span className="tabular-nums">
                        {formatCents(r.balanceCents, currency)}
                      </span>
                    </div>
                    {r.note && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">{r.note}</p>
                    )}
                  </div>
                  <DeleteSnapshotDialog snapshotId={r.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
