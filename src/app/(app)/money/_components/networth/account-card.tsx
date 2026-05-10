"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArchiveRestore,
  Eye,
  EyeOff,
  History,
  LineChart,
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
  setTrackHoldings,
  unarchiveFinancialAccount
} from "@/app/(app)/money/actions";
import { AccountDetailEnrichment } from "@/app/(app)/money/_components/networth/account-detail-enrichment";
import {
  AccountForm,
  type AccountFormValues
} from "@/app/(app)/money/_components/networth/account-form";
import { ArchiveAccountDialog } from "@/app/(app)/money/_components/networth/archive-account-dialog";
import { HoldingsList } from "@/app/(app)/money/_components/networth/holdings/holdings-list";
import {
  SnapshotHistorySheet,
  type SnapshotHistoryRow
} from "@/app/(app)/money/_components/networth/snapshot-history-sheet";
import { UpdateBalanceDialog } from "@/app/(app)/money/_components/networth/update-balance-dialog";
import type { FinancialAccountRow } from "@/lib/money/account-queries";
import type { HoldingRow } from "@/lib/money/holding-queries";

function bpsToPercentString(bps: number | null): string {
  if (bps === null || bps === undefined) return "";
  return (bps / 100).toString();
}

function centsToInput(cents: number | null): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toString();
}

export function AccountCard({
  account,
  currency,
  timezone,
  snapshots,
  holdings
}: {
  account: FinancialAccountRow;
  currency: string;
  timezone: string;
  snapshots: SnapshotHistoryRow[];
  holdings: HoldingRow[];
}) {
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, start] = useTransition();

  const meta = isKnownAccountType(account.type)
    ? ACCOUNT_TYPE_META[account.type]
    : ACCOUNT_TYPE_META.other;
  const Icon = meta.icon;
  const isTrackable = account.type === "investment" || account.type === "crypto";

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

  function toggleTrackHoldings() {
    const next = !account.trackHoldings;
    start(async () => {
      try {
        await setTrackHoldings(account.id, next);
        toast.success(
          next ? "Holdings tracking on." : "Holdings tracking off. Balance frozen at last value."
        );
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
      <CardContent className="space-y-3 p-4">
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
              {account.institution && <span>· at {account.institution}</span>}
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

        <AccountDetailEnrichment
          account={account}
          holdings={holdings}
          currency={currency}
          timezone={timezone}
        />

        {isTrackable && account.trackHoldings && (
          <HoldingsList
            accountId={account.id}
            accountType={account.type === "crypto" ? "crypto" : "investment"}
            holdings={holdings}
            currency={currency}
          />
        )}

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
          ) : account.trackHoldings ? (
            <p className="text-xs text-muted-foreground">
              Balance is derived from holdings — update prices instead.
            </p>
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
                {isTrackable && (
                  <DropdownMenuItem onSelect={toggleTrackHoldings}>
                    <LineChart />
                    <span>
                      {account.trackHoldings ? "Stop tracking holdings" : "Track holdings"}
                    </span>
                  </DropdownMenuItem>
                )}
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
                notes: account.notes ?? "",
                rate: bpsToPercentString(account.rateBps),
                institution: account.institution ?? "",
                trackHoldings: account.trackHoldings,
                creditLimit: centsToInput(account.creditLimitCents),
                statementDay: account.statementDay ? String(account.statementDay) : "",
                paymentDueDay: account.paymentDueDay ? String(account.paymentDueDay) : "",
                originalPrincipal: centsToInput(account.originalPrincipalCents),
                monthlyPayment: centsToInput(account.monthlyPaymentCents),
                loanTermMonths: account.loanTermMonths ? String(account.loanTermMonths) : "",
                loanStartedAt:
                  account.loanStartedAt
                    ? account.loanStartedAt.toISOString().slice(0, 10)
                    : ""
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
  return (
    <div className="px-1 py-0.5">
      <ArchiveAccountDialog accountId={accountId} name={name} />
    </div>
  );
}
