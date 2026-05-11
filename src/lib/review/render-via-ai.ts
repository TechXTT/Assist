import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { generateText } from "@/lib/ai/client";
import { REVIEW_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { ReviewPayload } from "@/lib/review/payload";
import type { AiReviewRenderer } from "@/lib/review/get-or-create";

function compactPayload(p: ReviewPayload) {
  const tz = p.tz;
  return {
    firstName: p.firstName,
    weekLabel: p.weekLabel,
    currency: p.currency,
    completed: {
      count: p.completed.count,
      highlights: p.completed.highlights.map((t) => t.title)
    },
    events: {
      count: p.events.count,
      highlights: p.events.highlights.map((e) => ({
        title: e.title,
        day: format(toZonedTime(e.startsAt, tz), "EEE")
      }))
    },
    slipped: {
      overdueOpenCount: p.overdueOpen.count,
      overdueOpenTitles: p.overdueOpen.titles,
      daysWithoutMood: p.daysWithoutMood,
      exerciseMinutes: p.exerciseMinutes,
      exerciseTargetMinutes: p.exerciseTargetMinutes,
      sleepAvg7Hours: p.sleepAvg7Hours
    },
    money: p.money
  };
}

export const aiReviewRenderer: AiReviewRenderer = async (userId, payload) => {
  if (!payload.hasAnyData) return null;
  const result = await generateText({
    userId,
    feature: "weekly_review",
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    userPayload: JSON.stringify(compactPayload(payload)),
    maxTokens: 500
  });
  if (!result) return null;
  return { body: result.body, model: result.model };
};
