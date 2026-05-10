"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Countdown } from "@/components/countdown";
import { setTaskStatus } from "@/app/(app)/tasks/actions";
import { TaskForm, type TaskFormValues } from "@/app/(app)/tasks/_components/task-form";
import { DeleteTaskDialog } from "@/app/(app)/tasks/_components/delete-task-dialog";
import { useMediaQuery } from "@/hooks/use-media-query";

export type DetailTask = {
  id: string;
  title: string;
  description: string | null;
  dueAt: Date | string | null;
  priority: string;
  status: string;
  tinyFirstStep: string | null;
};

const STATUSES: { value: "todo" | "doing" | "done"; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" }
];

function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const date = new Date(d);
  // datetime-local needs "yyyy-MM-ddTHH:mm" in local time.
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function TaskDetailSheet({
  task,
  onOpenChange
}: {
  task: DetailTask | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = task != null;
  const [editing, setEditing] = useState(false);
  const [pendingStatus, startStatus] = useTransition();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const side = isDesktop ? "right" : "bottom";
  const sheetClass = isDesktop
    ? "w-full overflow-y-auto sm:max-w-md"
    : "max-h-[85dvh] overflow-y-auto rounded-t-xl";

  function close() {
    setEditing(false);
    onOpenChange(false);
  }

  function handleStatus(next: "todo" | "doing" | "done") {
    if (!task || pendingStatus || next === task.status) return;
    startStatus(async () => {
      try {
        await setTaskStatus(task.id, next);
        if (next === "done") toast.success("Done. Nice.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't change status.");
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent side={side} className={sheetClass}>
        {task && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-base">{task.title}</SheetTitle>
            </SheetHeader>

            {!editing ? (
              <div className="mt-6 space-y-5">
                {task.dueAt && (
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Due</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span>{format(new Date(task.dueAt), "EEE d MMM, HH:mm")}</span>
                      <Countdown dueAt={task.dueAt} />
                    </div>
                  </div>
                )}

                {task.description && (
                  <div className="text-sm">
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                  </div>
                )}

                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1.5 inline-flex rounded-md border bg-background p-0.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        disabled={pendingStatus}
                        onClick={() => handleStatus(s.value)}
                        className={cn(
                          "rounded px-3 py-1 text-xs font-medium transition-colors",
                          task.status === s.value
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted",
                          pendingStatus && "opacity-60"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {task.status === "todo" && task.tinyFirstStep && (
                  <div className="rounded-md border-l-2 border-stone-300 bg-muted/40 p-3 text-sm italic text-muted-foreground">
                    {task.tinyFirstStep}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <DeleteTaskDialog taskId={task.id} onDeleted={close} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <TaskForm
                  mode="edit"
                  taskId={task.id}
                  defaultValues={
                    {
                      title: task.title,
                      description: task.description ?? "",
                      dueAt: toLocalInput(task.dueAt),
                      priority: task.priority as TaskFormValues["priority"]
                    } satisfies TaskFormValues
                  }
                  onDone={() => {
                    setEditing(false);
                  }}
                />
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
