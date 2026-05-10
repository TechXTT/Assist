import Link from "next/link";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/countdown";
import { urgencyOf, urgencyStripeClass } from "@/lib/tasks/urgency";

type DeadlineItem = {
  id: string;
  title: string;
  dueAt: Date;
  priority: string;
  tinyFirstStep: string | null;
};

export function DeadlinesCard({ items }: { items: DeadlineItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Deadlines this week</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        {items.length === 0 ? (
          <p className="px-4 pb-2 text-sm text-muted-foreground">
            Nothing on the horizon. Looking peaceful 🍃
          </p>
        ) : (
          <ul className="space-y-1.5">
            {items.map((t) => {
              const u = urgencyOf(t.dueAt);
              return (
                <li key={t.id}>
                  <Link
                    href="/tasks"
                    className="group flex items-stretch gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                  >
                    <span className={cn("w-1 shrink-0 rounded-full", urgencyStripeClass[u])} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="truncate text-sm">{t.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(t.dueAt, "EEE d MMM, HH:mm")}</span>
                        <Countdown dueAt={t.dueAt} />
                      </div>
                      {t.tinyFirstStep && (
                        <p className="truncate text-xs italic text-muted-foreground/80">
                          tiny step: {t.tinyFirstStep}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
