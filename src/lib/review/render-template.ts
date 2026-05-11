import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { formatCents } from "@/lib/money/format";
import type { ReviewPayload } from "@/lib/review/payload";

function listSentence(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

function recapParagraph(p: ReviewPayload): string {
  const parts: string[] = [];
  if (p.completed.count > 0) {
    const list = p.completed.highlights.map((t) => `"${t.title}"`);
    parts.push(
      `You closed ${p.completed.count} task${p.completed.count === 1 ? "" : "s"}${
        list.length > 0 ? ` — ${listSentence(list)}` : ""
      }`
    );
  } else {
    parts.push("No tasks closed this week");
  }
  if (p.events.count > 0) {
    const eventList = p.events.highlights.map(
      (e) => `${e.title} (${format(toZonedTime(e.startsAt, p.tz), "EEE")})`
    );
    parts.push(`${p.events.count} calendar event${p.events.count === 1 ? "" : "s"} — ${listSentence(eventList)}`);
  }
  return `${parts.join(". ")}.`;
}

function slippedParagraph(p: ReviewPayload): string {
  const parts: string[] = [];
  if (p.overdueOpen.count > 0) {
    const list = p.overdueOpen.titles.map((t) => `"${t}"`);
    parts.push(
      `${p.overdueOpen.count} task${p.overdueOpen.count === 1 ? "" : "s"} still open past due${
        list.length > 0 ? ` (${listSentence(list)})` : ""
      }`
    );
  }
  if (p.exerciseTargetMinutes > 0) {
    parts.push(
      `${p.exerciseMinutes} of ${p.exerciseTargetMinutes} exercise min logged`
    );
  } else if (p.exerciseMinutes > 0) {
    parts.push(`${p.exerciseMinutes} exercise min logged`);
  }
  if (p.sleepAvg7Hours !== null) {
    parts.push(`${p.sleepAvg7Hours.toFixed(1)}h sleep avg`);
  }
  if (p.daysWithoutMood > 0 && p.daysWithoutMood < 7) {
    parts.push(`${p.daysWithoutMood} day${p.daysWithoutMood === 1 ? "" : "s"} without a mood entry`);
  }
  if (parts.length === 0) return "Nothing obvious to flag this week.";
  return `Where it slipped: ${listSentence(parts)}.`;
}

function moneyParagraph(p: ReviewPayload): string {
  const parts: string[] = [];
  const m = p.money;
  if (m.totalSpentCents > 0) {
    parts.push(
      `${formatCents(m.totalSpentCents, p.currency)} spent` +
        (m.weekShareOfBudgetCents > 0
          ? ` against a ${formatCents(m.weekShareOfBudgetCents, p.currency)} week-share of monthly budgets`
          : "")
    );
  }
  if (m.biggestCategory && m.biggestCategory.spentCents > 0) {
    parts.push(
      `biggest category was ${m.biggestCategory.name} at ${formatCents(m.biggestCategory.spentCents, p.currency)}`
    );
  }
  if (m.netInOutCents) {
    const net = m.netInOutCents.netCents;
    parts.push(
      `${formatCents(m.netInOutCents.inCents, p.currency)} in, ${formatCents(m.netInOutCents.outCents, p.currency)} out — ${net >= 0 ? "net positive" : "net negative"}`
    );
  }
  if (m.savingsDeltaCents > 0) {
    parts.push(`${formatCents(m.savingsDeltaCents, p.currency)} sitting in savings goals`);
  }
  if (m.subscriptionCreep) {
    parts.push(
      `subscriptions add up to ${formatCents(m.subscriptionCreep.monthlyCents, p.currency)}/month (~${m.subscriptionCreep.percentOfMonthly}% of monthly budget)`
    );
  }
  if (parts.length === 0) return "No money activity this week.";
  return `Money: ${listSentence(parts)}.`;
}

export function renderReviewTemplate(payload: ReviewPayload): string {
  if (!payload.hasAnyData) {
    return `Hey ${payload.firstName} — quiet week. Nothing logged across tasks, calendar, money, or health. Try filling something in to start building a history.`;
  }
  return [
    recapParagraph(payload),
    slippedParagraph(payload),
    moneyParagraph(payload)
  ].join("\n\n");
}
