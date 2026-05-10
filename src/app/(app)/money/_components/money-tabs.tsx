"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MoneyTab =
  | "spending"
  | "budgets"
  | "bills"
  | "income"
  | "goals"
  | "cashflow"
  | "networth";

const TAB_ORDER: { value: MoneyTab; label: string }[] = [
  { value: "spending", label: "Spending" },
  { value: "budgets", label: "Budgets" },
  { value: "bills", label: "Bills" },
  { value: "income", label: "Income" },
  { value: "goals", label: "Goals" },
  { value: "cashflow", label: "Cash flow" },
  { value: "networth", label: "Net worth" }
];

export function MoneyTabs({
  defaultTab,
  spending,
  budgets,
  bills,
  income,
  goals,
  cashflow,
  networth
}: {
  defaultTab: MoneyTab;
  spending: ReactNode;
  budgets: ReactNode;
  bills: ReactNode;
  income: ReactNode;
  goals: ReactNode;
  cashflow: ReactNode;
  networth: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  function setTab(next: string) {
    const params = new URLSearchParams(search.toString());
    if (next === "spending") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const slots: Record<MoneyTab, ReactNode> = {
    spending,
    budgets,
    bills,
    income,
    goals,
    cashflow,
    networth
  };

  return (
    <Tabs value={defaultTab} onValueChange={setTab} className="space-y-6">
      {/*
        7 tabs at 375px is too tight for a uniform grid. On md+ we render
        a proper grid-cols-7; under md the row scrolls horizontally so
        labels stay legible without truncation.
      */}
      <div className="-mx-1 overflow-x-auto px-1 md:mx-0 md:overflow-visible md:px-0">
        <TabsList className="flex w-max gap-1 md:grid md:w-full md:grid-cols-7 md:gap-0">
          {TAB_ORDER.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="shrink-0 md:shrink">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {TAB_ORDER.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          {slots[t.value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
