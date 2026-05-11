import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { startOfDay } from "date-fns";

import { prisma } from "@/lib/db";
import {
  buildBriefingPayload,
  type BriefingPayload
} from "@/lib/briefing/payload";
import { renderBriefingTemplate } from "@/lib/briefing/render-template";

const REGEN_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Normalize an arbitrary `Date` to the user-local midnight UTC instant that
 * canonically represents that day. All briefings are keyed by this value.
 */
export function briefingDateKey(forDate: Date, tz: string): Date {
  const local = toZonedTime(forDate, tz);
  return fromZonedTime(startOfDay(local), tz);
}

export type GetOrCreateOptions = {
  /** When true, ignore cached row and regenerate (subject to cooldown). */
  forceRegen?: boolean;
};

export type BriefingRow = {
  body: string;
  generatedBy: string;
  modelUsed: string | null;
  generatedAt: Date;
};

/**
 * Render the briefing via AI if the caller has the renderer plugged in.
 * Returns `null` to signal "fall back to template" — set by `renderViaAi`
 * implementation when key is missing or cap is hit.
 */
export type AiRenderer = (
  userId: string,
  payload: BriefingPayload
) => Promise<{ body: string; model: string } | null>;

export async function getOrCreateBriefing(
  userId: string,
  forDate: Date,
  tz: string,
  currency: string,
  opts: GetOrCreateOptions & { aiRenderer?: AiRenderer } = {}
): Promise<BriefingRow> {
  const key = briefingDateKey(forDate, tz);

  if (!opts.forceRegen) {
    const existing = await prisma.dailyBriefing.findUnique({
      where: { userId_forDate: { userId, forDate: key } },
      select: {
        body: true,
        generatedBy: true,
        modelUsed: true,
        generatedAt: true
      }
    });
    if (existing) return existing;
  } else {
    // Cooldown enforcement
    const existing = await prisma.dailyBriefing.findUnique({
      where: { userId_forDate: { userId, forDate: key } },
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

  const payload = await buildBriefingPayload(userId, forDate, tz, currency);

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
        body = renderBriefingTemplate(payload);
      }
    } catch {
      body = renderBriefingTemplate(payload);
    }
  } else {
    body = renderBriefingTemplate(payload);
  }
  if (!body) body = renderBriefingTemplate(payload);

  const saved = await prisma.dailyBriefing.upsert({
    where: { userId_forDate: { userId, forDate: key } },
    update: { body, generatedBy, modelUsed, generatedAt: new Date() },
    create: { userId, forDate: key, body, generatedBy, modelUsed },
    select: { body: true, generatedBy: true, modelUsed: true, generatedAt: true }
  });
  return saved;
}

/**
 * Load past briefings for the date selector. Read-only.
 */
export async function listBriefingHistory(userId: string, limit = 30) {
  return prisma.dailyBriefing.findMany({
    where: { userId },
    orderBy: { forDate: "desc" },
    take: limit,
    select: { forDate: true, generatedBy: true, generatedAt: true }
  });
}

export async function getBriefingForDate(userId: string, forDate: Date, tz: string) {
  const key = briefingDateKey(forDate, tz);
  return prisma.dailyBriefing.findUnique({
    where: { userId_forDate: { userId, forDate: key } },
    select: { body: true, generatedBy: true, modelUsed: true, generatedAt: true }
  });
}
