"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  deleteRemindersForTask,
  upsertRemindersForTask
} from "@/lib/tasks/reminders";

const PRIORITY = z.enum(["low", "med", "high"]);
const STATUS = z.enum(["todo", "doing", "done"]);

const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Give it a title.").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  dueAt: z.string().optional().nullable(), // ISO from datetime-local
  priority: PRIORITY.default("med")
});

const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

async function requireOwnedTask(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, userId: true, dueAt: true, title: true, status: true }
  });
  if (!task || task.userId !== userId) throw new Error("Task not found.");
  return task;
}

function parseDue(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function createTask(input: CreateTaskInput) {
  const session = await requireSession();
  const data = createTaskSchema.parse(input);
  const dueAt = parseDue(data.dueAt);

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title,
      description: data.description ?? null,
      dueAt,
      priority: data.priority,
      status: "todo",
      source: "manual"
    }
  });

  if (dueAt) {
    await upsertRemindersForTask(task.id, session.user.id, dueAt);
  }
  revalidateTasks();
  return { id: task.id };
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  const session = await requireSession();
  const data = updateTaskSchema.parse(input);
  const existing = await requireOwnedTask(id, session.user.id);

  const dueProvided = Object.prototype.hasOwnProperty.call(data, "dueAt");
  const newDueAt = dueProvided ? parseDue(data.dueAt) : existing.dueAt;
  const titleChanged = typeof data.title === "string" && data.title !== existing.title;

  await prisma.task.update({
    where: { id },
    data: {
      ...(typeof data.title === "string" && { title: data.title }),
      ...(typeof data.description !== "undefined" && {
        description: data.description ?? null
      }),
      ...(dueProvided && { dueAt: newDueAt }),
      ...(typeof data.priority !== "undefined" && { priority: data.priority }),
      // Title edits clear the stale tiny-first-step suggestion.
      ...(titleChanged && { tinyFirstStep: null })
    }
  });

  if (dueProvided) {
    if (newDueAt) {
      await upsertRemindersForTask(id, session.user.id, newDueAt);
    } else {
      await deleteRemindersForTask(id);
    }
  }

  revalidateTasks();
}

export async function setTaskStatus(id: string, status: z.infer<typeof STATUS>) {
  const session = await requireSession();
  STATUS.parse(status);
  const existing = await requireOwnedTask(id, session.user.id);

  const movingOutOfTodo = existing.status === "todo" && status !== "todo";
  const completing = status === "done";
  const uncompleting = existing.status === "done" && status !== "done";

  await prisma.task.update({
    where: { id },
    data: {
      status,
      ...(completing && { completedAt: new Date() }),
      ...(uncompleting && { completedAt: null }),
      ...(movingOutOfTodo && { tinyFirstStep: null })
    }
  });

  // Completing kills pending reminders; un-completing rebuilds them if the task still has a dueAt.
  if (completing) {
    await deleteRemindersForTask(id);
  } else if (uncompleting && existing.dueAt) {
    await upsertRemindersForTask(id, session.user.id, existing.dueAt);
  }

  revalidateTasks();
}

export async function deleteTask(id: string) {
  const session = await requireSession();
  await requireOwnedTask(id, session.user.id);
  // Cascade in schema handles reminders, but be explicit so we don't depend on it.
  await deleteRemindersForTask(id);
  await prisma.task.delete({ where: { id } });
  revalidateTasks();
}

export async function dismissReminder(id: string) {
  const session = await requireSession();
  const reminder = await prisma.reminder.findUnique({
    where: { id },
    select: { id: true, userId: true }
  });
  if (!reminder || reminder.userId !== session.user.id) throw new Error("Reminder not found.");
  await prisma.reminder.update({
    where: { id },
    data: { sentAt: new Date() }
  });
  revalidateTasks();
}
