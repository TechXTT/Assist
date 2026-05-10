import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Forecast } from "@/lib/money/cashflow";

export function IncompleteAccountsHint({
  accounts
}: {
  accounts: Forecast["incompleteAccounts"];
}) {
  if (accounts.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Missing data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          These accounts could feed the forecast — they need a couple of fields filled in.
        </p>
        <ul className="space-y-1.5 text-sm">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-start gap-2">
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {a.type}
              </span>
              <span className="min-w-0 flex-1">
                <span className="truncate font-medium">{a.name}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  — add {a.missing.join(" + ")} to include this in the forecast.
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-1 text-xs text-muted-foreground">
          Edit each on the{" "}
          <Link href="/money?tab=networth" className="underline-offset-2 hover:underline">
            Net worth tab
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
