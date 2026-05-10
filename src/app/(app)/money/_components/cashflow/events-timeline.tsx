"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Banknote,
  CreditCard,
  Landmark,
  Receipt,
  Repeat,
  Sparkles,
  Wallet
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money/format";
import type { ForecastEvent, ForecastEventKind } from "@/lib/money/cashflow";

type Filter = "all" | "income" | "bills" | "subscriptions" | "loan_credit" | "discretionary";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "bills", label: "Bills" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "loan_credit", label: "Loan & Credit" },
  { value: "discretionary", label: "Discretionary" }
];

const KIND_ICON: Record<ForecastEventKind, typeof Banknote> = {
  income: Banknote,
  bill: Receipt,
  subscription: Repeat,
  loan_payment: Landmark,
  credit_payment: CreditCard,
  discretionary: Sparkles
};

function passesFilter(event: ForecastEvent, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "income") return event.kind === "income";
  if (filter === "bills") return event.kind === "bill";
  if (filter === "subscriptions") return event.kind === "subscription";
  if (filter === "loan_credit")
    return event.kind === "loan_payment" || event.kind === "credit_payment";
  if (filter === "discretionary") return event.kind === "discretionary";
  return true;
}

export function EventsTimeline({
  events,
  currency
}: {
  events: ForecastEvent[];
  currency: string;
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const out = events.filter((e) => passesFilter(e, filter));

    // Collapse all "discretionary" events into one summary row for the
    // selected view (the brief specifies this rendering).
    if (filter !== "discretionary") {
      const discretionary = out.filter((e) => e.kind === "discretionary");
      if (discretionary.length === 0 || filter === "all") {
        // For "all", include discretionary inline but collapse them into one
        // synthetic row at the top so the user sees they exist without 13
        // rows of clutter.
      }
    }

    return out;
  }, [events, filter]);

  // Group all discretionary into one synthetic row when filter is "all";
  // keep individual rows when filter is "discretionary".
  const displayEvents = useMemo(() => {
    if (filter === "discretionary") return filtered;
    const explicit = filtered.filter((e) => e.kind !== "discretionary");
    const discretionary = filtered.filter((e) => e.kind === "discretionary");
    if (discretionary.length === 0) return explicit;
    const totalCents = discretionary.reduce((s, e) => s + e.amountCents, 0);
    const synthetic: ForecastEvent = {
      at: discretionary[0].at,
      kind: "discretionary",
      label: `Daily discretionary · ${discretionary.length} ${
        discretionary.length === 1 ? "week" : "weeks"
      } estimated`,
      amountCents: totalCents
    };
    return [synthetic, ...explicit].sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [filtered, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, ForecastEvent[]>();
    for (const e of displayEvents) {
      const key = format(new Date(e.at), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      label: format(new Date(key), "EEE d MMM"),
      events: list
    }));
  }, [displayEvents]);

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
              filter === f.value
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">No events match that filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <section key={g.key}>
              <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h3>
              <ul className="divide-y rounded-md border bg-background">
                {g.events.map((e, i) => {
                  const Icon = KIND_ICON[e.kind] ?? Wallet;
                  const inflow = e.amountCents > 0;
                  const discretionary = e.kind === "discretionary";
                  return (
                    <li
                      key={`${e.kind}-${e.sourceId ?? "syn"}-${i}`}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2",
                        discretionary && "opacity-70"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-sm">{e.label}</span>
                      <span
                        className={cn(
                          "shrink-0 text-sm tabular-nums",
                          inflow && "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {inflow ? "+" : ""}
                        {formatCents(e.amountCents, currency)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
