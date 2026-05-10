import { BillsList } from "@/app/(app)/money/_components/bills-and-subs/bills/bills-list";
import { AddBillButton } from "@/app/(app)/money/_components/bills-and-subs/bills/add-bill-button";
import { AddSubButton } from "@/app/(app)/money/_components/bills-and-subs/subs/add-sub-button";
import { SubsList } from "@/app/(app)/money/_components/bills-and-subs/subs/subs-list";
import type { BillRow } from "@/lib/money/bill-queries";
import type { CategoryRow } from "@/lib/money/category-queries";
import type { SubscriptionRow } from "@/lib/money/subscription-queries";

export function BillsAndSubsTab({
  bills,
  subscriptions,
  categories,
  currency
}: {
  bills: BillRow[];
  subscriptions: SubscriptionRow[];
  categories: CategoryRow[];
  currency: string;
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Subscriptions</h2>
            <p className="text-xs text-muted-foreground">The ones that nibble at your card.</p>
          </div>
          <AddSubButton categories={categories} currency={currency} />
        </div>
        <SubsList subs={subscriptions} categories={categories} currency={currency} />
      </section>
    </div>
  );
}
