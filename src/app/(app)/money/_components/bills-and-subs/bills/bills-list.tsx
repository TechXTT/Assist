import { BillCard } from "@/app/(app)/money/_components/bills-and-subs/bills/bill-card";
import type { BillRow } from "@/lib/money/bill-queries";
import type { CategoryRow } from "@/lib/money/category-queries";

export function BillsList({
  bills,
  categories,
  currency
}: {
  bills: BillRow[];
  categories: CategoryRow[];
  currency: string;
}) {
  if (bills.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No bills tracked yet. Add the recurring ones — phone, rent, gym.
        </p>
      </div>
    );
  }

  const colorByName = new Map(categories.map((c) => [c.name, c.color]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {bills.map((b) => (
        <BillCard
          key={b.id}
          bill={b}
          categoryColorByName={colorByName}
          currency={currency}
          categories={categories}
        />
      ))}
    </div>
  );
}
