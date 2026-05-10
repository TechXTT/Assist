import Link from "next/link";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/countdown";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-stone-400",
  med: "bg-amber-500",
  high: "bg-red-500"
};

type TodayItem = {
  id: string;
  title: string;
  dueAt: Date | null;
  priority: string;
};

export function TodayCard({ items }: { items: TodayItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Today</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing due today — enjoy it.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((t) => (
              <li key={t.id}>
                <Link
                  href="/tasks"
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <span
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.med
                    )}
                  />
                  <span className="flex-1 truncate text-sm">{t.title}</span>
                  {t.dueAt && (
                    <span className="text-xs text-muted-foreground">
                      {format(t.dueAt, "HH:mm")}
                    </span>
                  )}
                  {t.dueAt && <Countdown dueAt={t.dueAt} />}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
