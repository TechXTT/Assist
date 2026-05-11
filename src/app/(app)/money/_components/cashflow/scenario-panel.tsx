"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Beaker, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { formatCents } from "@/lib/money/format";

export type ScenarioItem = {
  id: string;
  label: string;
  monthlyCents: number;
  kind: "bill" | "subscription" | "loan_payment" | "credit_payment";
};

const PARAM_BY_KIND: Record<ScenarioItem["kind"], "excludeBills" | "excludeSubs" | "excludeAccounts"> = {
  bill: "excludeBills",
  subscription: "excludeSubs",
  loan_payment: "excludeAccounts",
  credit_payment: "excludeAccounts"
};

export function ScenarioPanel({
  items,
  excludedIds,
  currency
}: {
  items: ScenarioItem[];
  excludedIds: Set<string>;
  currency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const excludedItems = useMemo(
    () => items.filter((i) => excludedIds.has(i.id)),
    [items, excludedIds]
  );
  const monthlySavedCents = excludedItems.reduce((s, i) => s + i.monthlyCents, 0);

  function toggleId(item: ScenarioItem) {
    const param = PARAM_BY_KIND[item.kind];
    const params = new URLSearchParams(search.toString());
    const current = (params.get(param) ?? "").split(",").filter(Boolean);
    const next = new Set(current);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    if (next.size === 0) params.delete(param);
    else params.set(param, Array.from(next).join(","));
    params.set("tab", "cashflow");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function reset() {
    const params = new URLSearchParams(search.toString());
    params.delete("excludeBills");
    params.delete("excludeSubs");
    params.delete("excludeAccounts");
    params.set("tab", "cashflow");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  if (items.length === 0) return null;

  return (
    <section className="space-y-3 rounded-md border bg-card p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Beaker className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-medium">Scenarios</h2>
          {excludedItems.length > 0 && (
            <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              −{formatCents(monthlySavedCents, currency)}/mo
            </span>
          )}
        </div>
        {excludedItems.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={reset}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </header>
      <p className="text-xs text-muted-foreground">
        Toggle a recurring item to exclude it from the forecast. Useful for &ldquo;what if I
        cancel X?&rdquo; thought experiments — nothing is actually deleted.
      </p>
      <ul className="divide-y rounded-md border bg-background">
        {items.map((item) => {
          const excluded = excludedIds.has(item.id);
          return (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className={excluded ? "truncate text-muted-foreground line-through" : "truncate"}>
                  {item.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {labelForKind(item.kind)} · {formatCents(item.monthlyCents, currency)}/mo
                </p>
              </div>
              <Switch
                checked={!excluded}
                onCheckedChange={() => toggleId(item)}
                aria-label={excluded ? `Include ${item.label}` : `Exclude ${item.label}`}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function labelForKind(kind: ScenarioItem["kind"]): string {
  switch (kind) {
    case "bill":
      return "Bill";
    case "subscription":
      return "Subscription";
    case "loan_payment":
      return "Loan payment";
    case "credit_payment":
      return "Credit payment";
  }
}
