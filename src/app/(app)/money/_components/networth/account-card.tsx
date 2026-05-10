"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArchiveRestore,
  Eye,
  EyeOff,
  History,
  MoreHorizontal,
  Pencil
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { formatCents } from "@/lib/money/format";
import {
  ACCOUNT_TYPE_META,
  isKnownAccountType
} from "@/lib/money/account-type-meta";
import {
  setIncludeInNetWorth,
  unarchiveFinancialAccount
} from "@/app/(app)/money/actions";
import {
  AccountForm,
  type AccountFormValues
} from "@/app/(app)/money/_components/networth/account-form";
import { ArchiveAccountDialog } from "@/app/(app)/money/_components/networth/archive-account-dialog";
import {
  SnapshotHistorySheet,
  type SnapshotHistoryRow
} from "@/app/(app)/money/_components/networth/snapshot-history-sheet";
import { UpdateBalanceDialog } from "@/app/(app)/money/_components/networth/update-balance-dialog";
import type { FinancialAccountRow } from "@/lib/money/account-queries";

export function AccountCard({
  account,
  currency,
  snapshots
}: {
  account: FinancialAccountRow;
  currency: string;
  snapshots: SnapshotHistoryRow[];
}) {
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, start] = useTransition();

  const meta = isKnownAccountType(account.type)
    ? ACCOUNT_TYPE_META[account.type]
    : ACCOUNT_TYPE_META.other;
  const Icon = meta.icon;

  const balanceLabel = formatCents(account.balanceCents, currency);
  const signedBalanceClass = account.isLiability
    ? "text-red-700 dark:text-red-400"
    : "tabular-nums";

  function toggleInclude() {
    const next = !account.includeInNetWorth;
    start(async () => {
      try {
        await setIncludeInNetWorth(account.id, next);
        toast.success(next ? "Included in net worth." : "Excluded from net worth.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  function unarchive() {
    start(async () => {
      try {
        await unarchiveFinancialAccount(account.id);
        toast.success("Restored.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't restore.");
      }
    });
  }

  return (
    <Card
      className={cn(
        !account.includeInNetWorth && "opacity-70",
        account.archived && "opacity-60"
      )}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-medium">
                {account.name}
                {!account.includeInNetWorth && (
                  <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                    excluded
                  </span>
                )}
              </h3>
              <span className={cn("shrink-0 text-sm tabular-nums", signedBalanceClass)}>
                {account.isLiability ? "−" : ""}
                {balanceLabel}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{meta.label}</span>
              {account.isLiability && <span>· liability</span>}
              {account.latestSnapshotAt && (
                <span>
                  · updated {formatDistanceToNow(account.latestSnapshotAt, { addSuffix: true })}
                </span>
              )}
            </div>
            {account.notes && (
              <p className="mt-1 text-xs italic text-muted-foreground">{account.notes}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {account.archived ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={unarchive}
              disabled={pending}
              className="gap-1.5"
            >
              <ArchiveRestore className="h-3.5 w-3.5" />
              Restore
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setUpdating(true)}
              className="gap-1.5"
            >
              Update balance
            </Button>
          )}

          {!account.archived && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  aria-label={`More for ${account.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                  <History />
                  <span>View history</span>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={toggleInclude}>
                  {account.includeInNetWorth ? <EyeOff /> : <Eye />}
                  <span>
                    {account.includeInNetWorth ? "Exclude from net worth" : "Include in net worth"}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ArchiveMenuItem accountId={account.id} name={account.name} />
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardContent>

      <UpdateBalanceDialog
        open={updating}
        onOpenChange={setUpdating}
        accountId={account.id}
        accountName={account.name}
        currentBalanceCents={account.balanceCents}
        currency={currency}
      />

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit account — {account.name}</DialogTitle>
          </DialogHeader>
          <AccountForm
            mode="edit"
            currency={currency}
            accountId={account.id}
            defaultValues={
              {
                name: account.name,
                type: (isKnownAccountType(account.type) ? account.type : "other") as
                  AccountFormValues["type"],
                isLiability: account.isLiability,
                startingBalance: "",
                notes: account.notes ?? ""
              } satisfies AccountFormValues
            }
            onDone={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>

      <SnapshotHistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        accountName={account.name}
        currency={currency}
        snapshots={snapshots}
      />
    </Card>
  );
}

function ArchiveMenuItem({ accountId, name }: { accountId: string; name: string }) {
  // Wrap the existing AlertDialog trigger as a menu item by rendering the
  // dialog inline; the DropdownMenuItem handler calls .click() on a hidden
  // button. Simpler: just render the ArchiveAccountDialog button — it acts
  // as a menu item visually with the same hover.
  return (
    <div className="px-1 py-0.5">
      <ArchiveAccountDialog accountId={accountId} name={name} />
    </div>
  );
}
