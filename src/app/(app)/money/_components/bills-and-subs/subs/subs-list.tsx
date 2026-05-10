import { SubCard } from "@/app/(app)/money/_components/bills-and-subs/subs/sub-card";
import type { SubscriptionRow } from "@/lib/money/subscription-queries";
import type { CategoryRow } from "@/lib/money/category-queries";

export function SubsList({
  subs,
  categories,
  currency
}: {
  subs: SubscriptionRow[];
  categories: CategoryRow[];
  currency: string;
}) {
  if (subs.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No subscriptions tracked yet. Add the ones that nibble at your card.
        </p>
      </div>
    );
  }

  const colorByName = new Map(categories.map((c) => [c.name, c.color]));

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {subs.map((s) => (
        <SubCard
          key={s.id}
          sub={s}
          currency={currency}
          categoryColorByName={colorByName}
          categories={categories}
        />
      ))}
    </div>
  );
}
