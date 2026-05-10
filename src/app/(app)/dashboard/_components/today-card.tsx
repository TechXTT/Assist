import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, CircleDashed, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Countdown } from "@/components/countdown";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-stone-400",
  med: "bg-amber-500",
  high: "bg-red-500"
};

export type TodayItem =
  | {
      kind: "task";
      id: string;
      title: string;
      dueAt: Date;
      priority: string;
    }
  | {
      kind: "event";
      id: string;
      title: string;
      startsAt: Date;
      endsAt: Date;
      allDay: boolean;
      location: string | null;
      htmlLink: string | null;
    };

export function TodayCard({ items }: { items: TodayItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Today</CardTitle>
      </CardHeader>
      <CardContent className="px-2">
        {items.length === 0 ? (
          <p className="px-4 pb-2 text-sm text-muted-foreground">
            Nothing on the schedule. Free as a bird 🕊️
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((item) =>
              item.kind === "task" ? <TaskRow key={`t-${item.id}`} item={item} /> : <EventRow key={`e-${item.id}`} item={item} />
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TaskRow({ item }: { item: Extract<TodayItem, { kind: "task" }> }) {
  return (
    <li>
      <Link
        href="/tasks"
        className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60"
      >
        <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span
          className={cn(
            "inline-block h-2 w-2 shrink-0 rounded-full",
            PRIORITY_DOT[item.priority] ?? PRIORITY_DOT.med
          )}
          aria-label={`priority ${item.priority}`}
        />
        <span className="flex-1 truncate text-sm">{item.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(item.dueAt, "HH:mm")}
        </span>
        <Countdown dueAt={item.dueAt} className="shrink-0" />
      </Link>
    </li>
  );
}

function EventRow({ item }: { item: Extract<TodayItem, { kind: "event" }> }) {
  const inner = (
    <div className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/60">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm">{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {item.allDay ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">All day</span>
          ) : (
            <span>
              {format(item.startsAt, "HH:mm")} – {format(item.endsAt, "HH:mm")}
            </span>
          )}
          {item.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{item.location}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <li>
      {item.htmlLink ? (
        <a href={item.htmlLink} target="_blank" rel="noopener noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  );
}
