"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type MoneyTab = "spending" | "budgets" | "bills" | "goals";

export function MoneyTabs({
  defaultTab,
  spending,
  budgets,
  bills,
  goals
}: {
  defaultTab: MoneyTab;
  spending: ReactNode;
  budgets: ReactNode;
  bills: ReactNode;
  goals: ReactNode;
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

  return (
    <Tabs value={defaultTab} onValueChange={setTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="spending">Spending</TabsTrigger>
        <TabsTrigger value="budgets">Budgets</TabsTrigger>
        <TabsTrigger value="bills">Bills &amp; subscriptions</TabsTrigger>
        <TabsTrigger value="goals">Goals</TabsTrigger>
      </TabsList>
      <TabsContent value="spending">{spending}</TabsContent>
      <TabsContent value="budgets">{budgets}</TabsContent>
      <TabsContent value="bills">{bills}</TabsContent>
      <TabsContent value="goals">{goals}</TabsContent>
    </Tabs>
  );
}
