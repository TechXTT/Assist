import type { ReactNode } from "react";

import { BillsList } from "@/app/(app)/money/_components/bills-and-subs/bills/bills-list";
import { AddBillButton } from "@/app/(app)/money/_components/bills-and-subs/bills/add-bill-button";
import type { BillRow } from "@/lib/money/bill-queries";
import type { CategoryRow } from "@/lib/money/category-queries";

export function BillsAndSubsTab({
  bills,
  categories,
  currency,
  subsSection
}: {
  bills: BillRow[];
  categories: CategoryRow[];
  currency: string;
  subsSection: ReactNode;
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Bills</h2>
            <p className="text-xs text-muted-foreground">
              Recurring or one-off. Reminders nudge you 3 days out.
            </p>
          </div>
          <AddBillButton categories={categories} currency={currency} />
        </div>
        <BillsList bills={bills} categories={categories} currency={currency} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-medium">Subscriptions</h2>
          <p className="text-xs text-muted-foreground">The ones that nibble at your card.</p>
        </div>
        {subsSection}
      </section>
    </div>
  );
}
