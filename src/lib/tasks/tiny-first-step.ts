import { prisma } from "@/lib/db";

const TEMPLATES = [
  "Open the relevant doc or note and write one sentence — that's it.",
  "Set a 5-minute timer and just look at the task. You don't have to start.",
  "Break it into 3 sub-points in your head. No commitment beyond that.",
  "Tell yourself you'll do it for 10 minutes, then stop if you want.",
  "Find the first thing you'd Google about this. Google it now.",
  "Open the file or app you'd need. That's the whole step.",
  "Write down what 'done' would look like in one line.",
  "Pick the smallest piece you could finish in 15 minutes and start there.",
  "Send yourself one message naming what's actually blocking you.",
  "Move it to Doing for the next 20 minutes and see what happens."
];

const DAY = 24 * 60 * 60 * 1000;

function pick(taskId: string): string {
  let h = 0;
  for (let i = 0; i < taskId.length; i++) {
    h = (h * 31 + taskId.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(h) % TEMPLATES.length;
  return TEMPLATES[idx];
}

type Candidate = {
  id: string;
  status: string;
  dueAt: Date | null;
  updatedAt: Date;
  tinyFirstStep: string | null;
};

function qualifies(task: Candidate, now: Date) {
  if (task.status !== "todo") return false;
  if (task.tinyFirstStep) return false;
  if (!task.dueAt) return false;
  const distance = task.dueAt.getTime() - now.getTime();
  if (distance < 0 || distance > 14 * DAY) return false;
  if (now.getTime() - task.updatedAt.getTime() < 3 * DAY) return false;
  return true;
}

/**
 * Lazy bulk evaluator — pass in only the tasks you're about to render.
 * Mutates DB for any task that qualifies, then returns a fresh map of
 * taskId → tinyFirstStep so the caller can render without a re-fetch.
 */
export async function populateTinyFirstSteps(
  tasks: Candidate[],
  now: Date = new Date()
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (const t of tasks) out.set(t.id, t.tinyFirstStep);

  const due = tasks.filter((t) => qualifies(t, now));
  if (due.length === 0) return out;

  await Promise.all(
    due.map(async (t) => {
      const suggestion = pick(t.id);
      await prisma.task.update({
        where: { id: t.id },
        data: { tinyFirstStep: suggestion }
      });
      out.set(t.id, suggestion);
    })
  );
  return out;
}
