"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import type { CategoryRow } from "@/lib/money/category-queries";

type Period = "this" | "last" | "custom";

export function TransactionFilters({
  period,
  from,
  to,
  selectedCategoryNames,
  categories
}: {
  period: Period;
  from: string;
  to: string;
  selectedCategoryNames: string[];
  categories: CategoryRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function update(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const selectedSet = useMemo(() => new Set(selectedCategoryNames), [selectedCategoryNames]);

  function togglePeriod(next: Period) {
    if (next === "this") update({ period: undefined, from: undefined, to: undefined });
    else if (next === "last") update({ period: "last", from: undefined, to: undefined });
    else update({ period: "custom" });
  }

  function toggleCategory(name: string) {
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    update({ categories: next.size === 0 ? undefined : Array.from(next).join(",") });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="inline-flex rounded-md border bg-background p-0.5">
        {(["this", "last", "custom"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => togglePeriod(p)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              period === p
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p === "this" ? "This month" : p === "last" ? "Last month" : "Custom"}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => update({ from: e.target.value || undefined })}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => update({ to: e.target.value || undefined })}
              className="h-8 w-[140px] text-xs"
            />
          </div>
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            {selectedSet.size === 0
              ? "All categories"
              : `${selectedSet.size} categor${selectedSet.size === 1 ? "y" : "ies"}`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
          {categories.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">No categories yet.</div>
          ) : (
            categories.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={selectedSet.has(c.name)}
                onSelect={(e) => {
                  e.preventDefault();
                  toggleCategory(c.name);
                }}
              >
                <span
                  aria-hidden
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                {c.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
