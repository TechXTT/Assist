/**
 * One-shot smoke test for the AI integration. Run with:
 *   npx tsx scripts/smoke-ai.ts
 *
 * Picks (or creates) a stub User row, then invokes each of the three AI
 * features against Haiku 4.5. Prints the generated prose and an
 * AiCall summary. Deletes nothing.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Tiny .env loader (avoids a new dependency for a one-shot script).
try {
  const envPath = resolve(process.cwd(), ".env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    if (process.env[key]) continue;
    process.env[key] = value.replace(/^"(.*)"$/, "$1");
  }
} catch (err) {
  console.error("[smoke] couldn't read .env:", err);
}

import { prisma } from "../src/lib/db";
import { generateText } from "../src/lib/ai/client";
import {
  BRIEFING_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  TINY_FIRST_STEP_SYSTEM_PROMPT
} from "../src/lib/ai/prompts";

async function main() {
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (!allowedEmail) {
    console.error("ALLOWED_EMAIL not set in .env");
    process.exit(1);
  }

  let user = await prisma.user.findUnique({ where: { email: allowedEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: allowedEmail, name: "Smoke Test", timezone: "Europe/Amsterdam" }
    });
    console.log(`[smoke] created user ${user.id}`);
  }
  const userId = user.id;

  console.log(`\n=== tiny_first_step ===`);
  const tiny = await generateText({
    userId,
    feature: "tiny_first_step",
    systemPrompt: TINY_FIRST_STEP_SYSTEM_PROMPT,
    userPayload: JSON.stringify({
      task: "Write linear algebra problem set",
      daysSinceUpdate: 6,
      daysUntilDeadline: 2
    }),
    maxTokens: 80
  });
  console.log(tiny ? tiny.body : "[returned null]");

  console.log(`\n=== daily_briefing ===`);
  const briefing = await generateText({
    userId,
    feature: "daily_briefing",
    systemPrompt: BRIEFING_SYSTEM_PROMPT,
    userPayload: JSON.stringify({
      firstName: "Bozhinov",
      forDate: "2026-05-11",
      currency: "EUR",
      todaysEvents: [
        { title: "Linear Algebra lecture", startsAt: "10:00", allDay: false },
        { title: "Gym", startsAt: "15:00", allDay: false }
      ],
      todaysTasks: [
        { title: "Lab report draft", dueAt: "23:59", priority: "high" }
      ],
      topPriorities: [
        { title: "Lab report draft", dueAt: "2026-05-11 23:59", priority: "high" },
        { title: "OS assignment", dueAt: "2026-05-14 17:00", priority: "med" }
      ],
      money: {
        upcomingBillsCount: 2,
        upcomingBillsTotalCents: 4500,
        overBudget: [{ name: "Groceries", percentUsed: 105 }],
        netMonthCents: 12000
      },
      health: {
        sleepAvg7Hours: 6.4,
        exerciseWeekMinutes: 32,
        exerciseTargetMinutes: 90,
        latestMood: 3
      },
      stalest: {
        id: "abc",
        title: "Cleanup laundry",
        tinyStep: "Open the laundry basket and sort one pile."
      }
    }),
    maxTokens: 400
  });
  console.log(briefing ? briefing.body : "[returned null]");

  console.log(`\n=== weekly_review ===`);
  const review = await generateText({
    userId,
    feature: "weekly_review",
    systemPrompt: REVIEW_SYSTEM_PROMPT,
    userPayload: JSON.stringify({
      firstName: "Bozhinov",
      weekLabel: "Mon 4 May → Sun 10 May",
      currency: "EUR",
      completed: { count: 7, highlights: ["Linear algebra problem set", "Lab report draft", "Sofia flight booking"] },
      events: { count: 12, highlights: [{ title: "Linear Algebra", day: "Mon" }, { title: "Gym", day: "Wed" }] },
      slipped: {
        overdueOpenCount: 2,
        overdueOpenTitles: ["OS assignment", "Send invoice"],
        daysWithoutMood: 2,
        exerciseMinutes: 90,
        exerciseTargetMinutes: 90,
        sleepAvg7Hours: 6.4
      },
      money: {
        totalSpentCents: 18430,
        weekShareOfBudgetCents: 22600,
        biggestCategory: { name: "Groceries", spentCents: 6420 },
        savingsDeltaCents: 30000,
        netInOutCents: { inCents: 35000, outCents: 18430, netCents: 16570 },
        subscriptionCreep: { monthlyCents: 7200, percentOfMonthly: 18 }
      }
    }),
    maxTokens: 500
  });
  console.log(review ? review.body : "[returned null]");

  console.log(`\n=== usage summary ===`);
  const calls = await prisma.aiCall.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 5,
    select: {
      feature: true,
      model: true,
      promptTokens: true,
      completionTokens: true,
      estimatedCostCents: true
    }
  });
  console.table(calls);

  const totalCents = calls.reduce((s, c) => s + c.estimatedCostCents, 0);
  console.log(`Recent total estimated: €${(totalCents / 100).toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[smoke] failed:", err);
  process.exit(1);
});
