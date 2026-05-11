import { prisma } from "@/lib/db";

import { buildReviewPayload, type ReviewPayload } from "@/lib/review/payload";
import { renderReviewTemplate } from "@/lib/review/render-template";
import type { Week } from "@/lib/review/week";

const REGEN_COOLDOWN_MS = 5 * 60 * 1000;

export type ReviewRow = {
  body: string;
  generatedBy: string;
  modelUsed: string | null;
  generatedAt: Date;
  topPriorities: string[];
};

export type AiReviewRenderer = (
  userId: string,
  payload: ReviewPayload
) => Promise<{ body: string; model: string } | null>;

function parseTopPriorities(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
  } catch {
    /* fall through */
  }
  return [];
}

export async function getOrCreateReview(
  userId: string,
  week: Week,
  tz: string,
  currency: string,
  opts: { forceRegen?: boolean; aiRenderer?: AiReviewRenderer } = {}
): Promise<ReviewRow> {
  if (!opts.forceRegen) {
    const existing = await prisma.weeklyReview.findUnique({
      where: { userId_forWeekStart: { userId, forWeekStart: week.key } },
      select: {
        body: true,
        generatedBy: true,
        modelUsed: true,
        generatedAt: true,
        topPriorities: true
      }
    });
    if (existing) {
      return {
        ...existing,
        topPriorities: parseTopPriorities(existing.topPriorities)
      };
    }
  } else {
    const existing = await prisma.weeklyReview.findUnique({
      where: { userId_forWeekStart: { userId, forWeekStart: week.key } },
      select: { generatedAt: true }
    });
    if (existing) {
      const since = Date.now() - existing.generatedAt.getTime();
      if (since < REGEN_COOLDOWN_MS) {
        const wait = Math.ceil((REGEN_COOLDOWN_MS - since) / 1000);
        throw new Error(`Try again in ${wait}s — cooldown.`);
      }
    }
  }

  const payload = await buildReviewPayload(userId, week, tz, currency);

  let body: string;
  let generatedBy: "template" | "ai" = "template";
  let modelUsed: string | null = null;

  if (opts.aiRenderer) {
    try {
      const aiResult = await opts.aiRenderer(userId, payload);
      if (aiResult) {
        body = aiResult.body;
        generatedBy = "ai";
        modelUsed = aiResult.model;
      } else {
        body = renderReviewTemplate(payload);
      }
    } catch {
      body = renderReviewTemplate(payload);
    }
  } else {
    body = renderReviewTemplate(payload);
  }
  if (!body) body = renderReviewTemplate(payload);

  const saved = await prisma.weeklyReview.upsert({
    where: { userId_forWeekStart: { userId, forWeekStart: week.key } },
    update: { body, generatedBy, modelUsed, generatedAt: new Date() },
    create: {
      userId,
      forWeekStart: week.key,
      body,
      generatedBy,
      modelUsed,
      topPriorities: null
    },
    select: {
      body: true,
      generatedBy: true,
      modelUsed: true,
      generatedAt: true,
      topPriorities: true
    }
  });
  return { ...saved, topPriorities: parseTopPriorities(saved.topPriorities) };
}

export async function setReviewTopPriorities(
  userId: string,
  weekKey: Date,
  taskIds: string[]
): Promise<void> {
  await prisma.weeklyReview.update({
    where: { userId_forWeekStart: { userId, forWeekStart: weekKey } },
    data: { topPriorities: JSON.stringify(taskIds) }
  });
  // Bump priorities on those tasks
  if (taskIds.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: taskIds }, userId },
      data: { priority: "high" }
    });
  }
}

export async function listReviewHistory(userId: string, limit = 12) {
  return prisma.weeklyReview.findMany({
    where: { userId },
    orderBy: { forWeekStart: "desc" },
    take: limit,
    select: { forWeekStart: true, generatedBy: true, generatedAt: true }
  });
}
