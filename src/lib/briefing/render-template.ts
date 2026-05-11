import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { formatCents } from "@/lib/money/format";
import type { BriefingEventRef, BriefingPayload, BriefingTaskRef } from "@/lib/briefing/payload";

function lower(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

function eventTimeLabel(e: BriefingEventRef, tz: string): string {
  if (e.allDay) return "all day";
  return format(toZonedTime(e.startsAt, tz), "HH:mm");
}

function listSentence(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1];
}

function describeDueDate(due: Date, now: Date, tz: string): string {
  const local = toZonedTime(due, tz);
  const today = toZonedTime(now, tz);
  const sameDay =
    local.getFullYear() === today.getFullYear() &&
    local.getMonth() === today.getMonth() &&
    local.getDate() === today.getDate();
  if (sameDay) return "today";
  const diff = Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff <= 7) return format(local, "EEEE");
  return format(local, "d MMM");
}

function describeTask(t: BriefingTaskRef, now: Date, tz: string): string {
  if (!t.dueAt) return t.title;
  return `${t.title} (due ${describeDueDate(t.dueAt, now, tz)})`;
}

function planSentence(payload: BriefingPayload): string {
  const tz = payload.tz;
  const parts: string[] = [];
  for (const e of payload.todaysEvents) {
    parts.push(`${lower(e.title)} ${e.allDay ? "(all day)" : `at ${eventTimeLabel(e, tz)}`}`);
  }
  for (const t of payload.todaysTasks) {
    if (t.dueAt) {
      parts.push(`${lower(t.title)} due by ${format(toZonedTime(t.dueAt, tz), "HH:mm")}`);
    } else {
      parts.push(lower(t.title));
    }
  }
  if (parts.length === 0) return "";
  return `You've got ${listSentence(parts)}.`;
}

function openerSentence(payload: BriefingPayload): string {
  const greeting = `Hey ${payload.firstName} —`;
  const firstEvent = payload.todaysEvents[0];
  const topTask = payload.topPriorities[0] ?? payload.todaysTasks[0] ?? null;

  if (firstEvent && !firstEvent.allDay) {
    return `${greeting} ${lower(firstEvent.title)} is up first at ${eventTimeLabel(firstEvent, payload.tz)}.`;
  }
  if (topTask?.dueAt) {
    return `${greeting} ${lower(topTask.title)} is the closest deadline, ${describeDueDate(topTask.dueAt, payload.forDate, payload.tz)}.`;
  }
  if (firstEvent) {
    return `${greeting} ${lower(firstEvent.title)} on the calendar today.`;
  }
  return `${greeting} nothing urgent on the calendar.`;
}

function moneySentences(payload: BriefingPayload): string {
  const parts: string[] = [];
  const { upcomingBills, overBudget, netMonthCents } = payload.money;

  if (upcomingBills.count > 0) {
    parts.push(
      `${upcomingBills.count} bill${upcomingBills.count === 1 ? "" : "s"} due in the next 7 days totalling ${formatCents(upcomingBills.totalCents, payload.currency)}`
    );
  }
  if (overBudget.length > 0) {
    const names = overBudget.slice(0, 2).map((b) => `${b.name} (${b.percentUsed}%)`);
    parts.push(`${listSentence(names)} over budget`);
  }
  if (netMonthCents !== null) {
    const verb = netMonthCents >= 0 ? "in the green" : "in the red";
    parts.push(`${formatCents(Math.abs(netMonthCents), payload.currency)} ${verb} for the month`);
  }

  if (parts.length === 0) return "";
  return `Money: ${listSentence(parts)}.`;
}

function healthSentences(payload: BriefingPayload): string {
  const parts: string[] = [];
  const { sleepAvg7Hours, exerciseWeekMinutes, exerciseTargetMinutes, latestMood } =
    payload.health;

  if (sleepAvg7Hours !== null) {
    parts.push(`${sleepAvg7Hours.toFixed(1)}h sleep avg over the last 7 nights`);
  }
  if (exerciseWeekMinutes > 0 || exerciseTargetMinutes > 0) {
    parts.push(`${exerciseWeekMinutes} of ${exerciseTargetMinutes} exercise min this week`);
  }
  if (latestMood !== null) {
    parts.push(`latest mood ${latestMood}`);
  }

  if (parts.length === 0) return "";
  return `Health: ${listSentence(parts)}.`;
}

function prioritiesSentence(payload: BriefingPayload): string {
  if (payload.topPriorities.length === 0) return "";
  const labels = payload.topPriorities.map((t) =>
    describeTask(t, payload.forDate, payload.tz)
  );
  return `Top priorities by deadline: ${listSentence(labels)}.`;
}

function tinyStepSentence(payload: BriefingPayload): string {
  if (!payload.stalest) return "";
  return `One tiny first step for "${payload.stalest.title}": ${payload.stalest.tinyStep}`;
}

export function renderBriefingTemplate(payload: BriefingPayload): string {
  if (!payload.hasAnyData) {
    return `Hey ${payload.firstName} — quiet morning. Nothing on the radar yet. Try adding a task or logging something on /tasks or /money.`;
  }

  const paragraph1 = [openerSentence(payload), planSentence(payload), prioritiesSentence(payload)]
    .filter(Boolean)
    .join(" ");
  const paragraph2 = [moneySentences(payload), healthSentences(payload)]
    .filter(Boolean)
    .join(" ");
  const paragraph3 = tinyStepSentence(payload);

  return [paragraph1, paragraph2, paragraph3].filter(Boolean).join("\n\n");
}
