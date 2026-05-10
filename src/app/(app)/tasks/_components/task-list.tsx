"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TaskCard, type TaskCardData } from "@/app/(app)/tasks/_components/task-card";

type Filter = "todo" | "doing" | "done" | "all";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" }
];

const EMPTY: Record<Filter, string> = {
  todo: "Nothing in your queue. Add a task to get started.",
  doing: "Nothing in flight.",
  done: "Nothing done yet — that's OK.",
  all: "No tasks yet."
};

export function TaskList({
  tasks,
  onSelect,
  className
}: {
  tasks: TaskCardData[];
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [filter, setFilter] = useState<Filter>("todo");

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className={cn("space-y-4", className)}>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid w-full grid-cols-4">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={filter} className="mt-4 space-y-2">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{EMPTY[filter]}</p>
          ) : (
            filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className="block w-full text-left"
              >
                <TaskCard task={t} />
              </button>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
