import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { generateText } from "@/lib/ai/client";
import { BRIEFING_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import type { BriefingPayload } from "@/lib/briefing/payload";
import type { AiRenderer } from "@/lib/briefing/get-or-create";

function compactPayload(p: BriefingPayload) {
  const tz = p.tz;
  return {
    firstName: p.firstName,
    forDate: format(toZonedTime(p.forDate, tz), "yyyy-MM-dd"),
    currency: p.currency,
    todaysEvents: p.todaysEvents.map((e) => ({
      title: e.title,
      startsAt: format(toZonedTime(e.startsAt, tz), "HH:mm"),
      allDay: e.allDay
    })),
    todaysTasks: p.todaysTasks.map((t) => ({
      title: t.title,
      dueAt: t.dueAt ? format(toZonedTime(t.dueAt, tz), "HH:mm") : null,
      priority: t.priority
    })),
    topPriorities: p.topPriorities.map((t) => ({
      title: t.title,
      dueAt: t.dueAt
        ? format(toZonedTime(t.dueAt, tz), "yyyy-MM-dd HH:mm")
        : null,
      priority: t.priority
    })),
    money: {
      upcomingBillsCount: p.money.upcomingBills.count,
      upcomingBillsTotalCents: p.money.upcomingBills.totalCents,
      overBudget: p.money.overBudget,
      netMonthCents: p.money.netMonthCents
    },
    health: {
      sleepAvg7Hours: p.health.sleepAvg7Hours,
      exerciseWeekMinutes: p.health.exerciseWeekMinutes,
      exerciseTargetMinutes: p.health.exerciseTargetMinutes,
      latestMood: p.health.latestMood
    },
    stalest: p.stalest
  };
}

export const aiBriefingRenderer: AiRenderer = async (userId, payload) => {
  if (!payload.hasAnyData) return null; // no point spending tokens on quiet days
  const result = await generateText({
    userId,
    feature: "daily_briefing",
    systemPrompt: BRIEFING_SYSTEM_PROMPT,
    userPayload: JSON.stringify(compactPayload(payload)),
    maxTokens: 400
  });
  if (!result) return null;
  return { body: result.body, model: result.model };
};
