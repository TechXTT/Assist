"use client";

import { format, isToday, isYesterday } from "date-fns";

import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/money/format";
import type { TransactionRow } from "@/lib/money/transaction-queries";

function dateLabel(d: Date): string {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE d MMM");
}

function groupByDay(rows: TransactionRow[]): { key: string; label: string; rows: TransactionRow[] }[] {
  const map = new Map<string, { label: string; rows: TransactionRow[] }>();
  for (const r of rows) {
    const key = format(r.occurredAt, "yyyy-MM-dd");
    if (!map.has(key)) map.set(key, { label: dateLabel(r.occurredAt), rows: [] });
    map.get(key)!.rows.push(r);
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
}

export function TransactionsList({
  transactions,
  currency,
  onSelect,
  emptyCopy,
  categoryColorByName
}: {
  transactions: TransactionRow[];
  currency: string;
  onSelect: (id: string) => void;
  emptyCopy: string;
  categoryColorByName: Map<string, string>;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyCopy}</p>
      </div>
    );
  }

  const groups = groupByDay(transactions);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="mb-1 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {g.label}
          </h3>
          <ul className="divide-y rounded-md border bg-background">
            {g.rows.map((t) => {
              const expense = t.amountCents < 0;
              const color = t.category ? categoryColorByName.get(t.category) ?? "#a8a29e" : "#a8a29e";
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                  >
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {t.description || (t.category ?? "Transaction")}
                      </p>
                      {t.description && t.category && (
                        <p className="text-xs text-muted-foreground">{t.category}</p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-sm tabular-nums",
                        expense ? "" : "font-medium text-emerald-600"
                      )}
                    >
                      {!expense && "+"}
                      {formatCents(t.amountCents, currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
