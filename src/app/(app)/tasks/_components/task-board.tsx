"use client";

import { useTransition, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { TaskCard, type TaskCardData } from "@/app/(app)/tasks/_components/task-card";

type Status = "todo" | "doing" | "done";

const COLUMNS: { id: Status; label: string; emptyCopy: string }[] = [
  { id: "todo", label: "Todo", emptyCopy: "Nothing in your queue." },
  { id: "doing", label: "Doing", emptyCopy: "Nothing in flight." },
  { id: "done", label: "Done", emptyCopy: "Nothing done yet — that's OK." }
];

function DraggableCard({
  task,
  onClick
}: {
  task: TaskCardData;
  onClick: () => void;
}) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: task.id,
    data: { from: task.status }
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // dnd-kit only triggers a real drag past activation distance, so ordinary
        // clicks land here. Block click during a drag just in case.
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
    >
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

function Column({
  id,
  label,
  emptyCopy,
  tasks,
  onSelect
}: {
  id: Status;
  label: string;
  emptyCopy: string;
  tasks: TaskCardData[];
  onSelect: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </h2>
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60vh] flex-col gap-3 rounded-lg border bg-muted/20 p-3 transition-colors",
          isOver && "border-foreground/30 bg-muted/60"
        )}
      >
        {tasks.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">{emptyCopy}</p>
        ) : (
          tasks.map((t) => <DraggableCard key={t.id} task={t} onClick={() => onSelect(t.id)} />)
        )}
      </div>
    </div>
  );
}

export function TaskBoard({
  tasks,
  onSelect,
  className
}: {
  tasks: TaskCardData[];
  onSelect: (id: string) => void;
  className?: string;
}) {
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const grouped: Record<Status, TaskCardData[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) {
    if (t.status === "todo" || t.status === "doing" || t.status === "done") {
      grouped[t.status as Status].push(t);
    }
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    const overId = e.over?.id;
    const taskId = String(e.active.id);
    if (!overId) return;
    const next = String(overId) as Status;
    const from = e.active.data.current?.from as Status | undefined;
    if (!next || next === from) return;

    startTransition(async () => {
      try {
        await setTaskStatus(taskId, next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't move that.");
      }
    });
  }

  const dragging = draggingId ? tasks.find((t) => t.id === draggingId) : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setDraggingId(String(e.active.id))}
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={handleDragEnd}
    >
      <div className={cn("grid gap-4 md:grid-cols-3", className)}>
        {COLUMNS.map((c) => (
          <Column
            key={c.id}
            id={c.id}
            label={c.label}
            emptyCopy={c.emptyCopy}
            tasks={grouped[c.id]}
            onSelect={onSelect}
          />
        ))}
      </div>
      <DragOverlay>{dragging ? <TaskCard task={dragging} /> : null}</DragOverlay>
    </DndContext>
  );
}
