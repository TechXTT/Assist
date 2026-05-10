"use client";

import { useMemo, useState } from "react";

import { TaskBoard } from "@/app/(app)/tasks/_components/task-board";
import { TaskList } from "@/app/(app)/tasks/_components/task-list";
import {
  TaskDetailSheet,
  type DetailTask
} from "@/app/(app)/tasks/_components/task-detail-sheet";
import type { TaskCardData } from "@/app/(app)/tasks/_components/task-card";

export type TaskViewRow = TaskCardData & {
  description: string | null;
  tinyFirstStep: string | null;
};

export function TasksView({ tasks }: { tasks: TaskViewRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const detail: DetailTask | null = useMemo(() => {
    if (!selectedId) return null;
    const t = tasks.find((x) => x.id === selectedId);
    if (!t) return null;
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      dueAt: t.dueAt,
      priority: t.priority,
      status: t.status,
      tinyFirstStep: t.tinyFirstStep
    };
  }, [selectedId, tasks]);

  return (
    <>
      <TaskBoard tasks={tasks} onSelect={setSelectedId} className="hidden md:grid" />
      <TaskList tasks={tasks} onSelect={setSelectedId} className="md:hidden" />
      <TaskDetailSheet
        task={detail}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
