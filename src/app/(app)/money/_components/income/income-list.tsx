import { IncomeSourceCard } from "@/app/(app)/money/_components/income/income-source-card";
import type { IncomeSourceRow } from "@/lib/money/income-queries";

export function IncomeList({
  sources,
  currency
}: {
  sources: IncomeSourceRow[];
  currency: string;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sources.map((s) => (
        <IncomeSourceCard key={s.id} source={s} currency={currency} />
      ))}
    </div>
  );
}
