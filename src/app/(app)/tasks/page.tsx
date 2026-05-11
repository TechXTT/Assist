import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { listAllTasks } from "@/lib/tasks/task-queries";
import { populateTinyFirstSteps } from "@/lib/tasks/tiny-first-step";
import { listActiveReminders } from "@/lib/reminders/active";
import { ReminderBanners } from "@/components/reminder-banners";
import { AddTaskButton } from "@/app/(app)/tasks/_components/add-task-button";
import { TasksView } from "@/app/(app)/tasks/_components/tasks-view";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [allTasks, activeReminders] = await Promise.all([
    listAllTasks(session.user.id),
    listActiveReminders(session.user.id)
  ]);

  const tinyMap = await populateTinyFirstSteps(
    allTasks.map((t) => ({
      id: t.id,
      status: t.status,
      dueAt: t.dueAt,
      updatedAt: t.updatedAt,
      tinyFirstStep: t.tinyFirstStep
    })),
    new Date(),
    session.user.id
  );

  const view = allTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueAt,
    completedAt: t.completedAt,
    tinyFirstStep: tinyMap.get(t.id) ?? null,
    reminders: t.reminders.map((r) => ({ id: r.id, level: r.level, fireAt: r.fireAt }))
  }));

  const hasAny = view.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Drag, drop, done. Or just click a card.
          </p>
        </div>
        <AddTaskButton />
      </div>

      <ReminderBanners reminders={activeReminders} />

      {hasAny ? (
        <TasksView tasks={view} />
      ) : (
        <div className="mx-auto max-w-md rounded-lg border border-dashed bg-muted/20 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing in your queue. Add a task to get started.
          </p>
          <div className="mt-4">
            <AddTaskButton />
          </div>
        </div>
      )}
    </div>
  );
}
