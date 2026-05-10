"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCents } from "@/lib/money/format";
import {
  ACCOUNT_TYPE_META,
  isKnownAccountType
} from "@/lib/money/account-type-meta";
import { setIncludeInCashFlow } from "@/app/(app)/money/actions";
import type { FinancialAccountRow } from "@/lib/money/account-queries";

export function CashFlowAccountsSheet({
  accounts,
  currency
}: {
  accounts: FinancialAccountRow[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const side = isDesktop ? "right" : "bottom";
  const sheetClass = isDesktop
    ? "w-full overflow-y-auto sm:max-w-md"
    : "max-h-[85dvh] overflow-y-auto rounded-t-xl";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground underline-offset-2 hover:underline">
          Cash flow accounts
        </Button>
      </SheetTrigger>
      <SheetContent side={side} className={sheetClass}>
        <SheetHeader>
          <SheetTitle>Cash flow accounts</SheetTitle>
          <SheetDescription>
            Toggle which accounts count toward your starting balance for the forecast.
          </SheetDescription>
        </SheetHeader>

        <ul className="mt-6 space-y-1">
          {accounts
            .filter((a) => !a.archived)
            .map((a) => (
              <AccountToggleRow key={a.id} account={a} currency={currency} />
            ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function AccountToggleRow({
  account,
  currency
}: {
  account: FinancialAccountRow;
  currency: string;
}) {
  const [included, setIncluded] = useState(account.includeInCashFlow ?? false);
  const [pending, start] = useTransition();
  const meta = isKnownAccountType(account.type)
    ? ACCOUNT_TYPE_META[account.type]
    : ACCOUNT_TYPE_META.other;
  const Icon = meta.icon;

  function toggle(next: boolean) {
    setIncluded(next);
    start(async () => {
      try {
        await setIncludeInCashFlow(account.id, next);
      } catch (err) {
        setIncluded(!next);
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/30">
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{account.name}</p>
        <p className="text-xs text-muted-foreground">
          {meta.label} · {formatCents(account.balanceCents, currency)}
        </p>
      </div>
      <Switch checked={included} onCheckedChange={toggle} disabled={pending} />
    </li>
  );
}
