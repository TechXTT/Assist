import Anthropic from "@anthropic-ai/sdk";

import { prisma } from "@/lib/db";
import { currentMonth } from "@/lib/money/period";
import { estimateCostCents } from "@/lib/ai/pricing";

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

let cachedClient: Anthropic | null | undefined = undefined;

function getClient(): Anthropic | null {
  if (cachedClient !== undefined) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    cachedClient = null;
    return null;
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export type AiFeature =
  | "tiny_first_step"
  | "daily_briefing"
  | "weekly_review"
  | "receipt_scan"
  | "categorize_transaction";

async function monthlySpendCents(userId: string, tz: string): Promise<number> {
  const month = currentMonth(tz);
  const agg = await prisma.aiCall.aggregate({
    where: { userId, occurredAt: { gte: month.start, lte: month.end } },
    _sum: { estimatedCostCents: true }
  });
  return agg._sum.estimatedCostCents ?? 0;
}

export type GenerateTextOptions = {
  userId: string;
  feature: AiFeature;
  systemPrompt: string;
  userPayload: string; // typically JSON.stringify of the payload
  model?: string;
  maxTokens?: number;
};

export type GenerateTextResult = {
  body: string;
  model: string;
};

/**
 * Generate prose via Anthropic Haiku 4.5. Returns null when:
 *   - ANTHROPIC_API_KEY is not set (caller cascades to template)
 *   - current-month spend has hit the user's cap (caller cascades)
 *   - the SDK call throws (we swallow and signal fallback)
 *
 * On success, persists an AiCall row with token counts + rough cost.
 */
export async function generateText(
  opts: GenerateTextOptions
): Promise<GenerateTextResult | null> {
  const client = getClient();
  if (!client) return null;

  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { aiMonthlyCapCents: true, timezone: true }
  });
  if (!user) return null;
  const tz = user.timezone || "Europe/Amsterdam";

  const spend = await monthlySpendCents(opts.userId, tz);
  if (spend >= user.aiMonthlyCapCents) return null;

  const model = opts.model ?? DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 600;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: opts.systemPrompt,
      messages: [
        {
          role: "user",
          content: opts.userPayload
        }
      ]
    });

    const text = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) return null;

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const costCents = estimateCostCents(model, inputTokens, outputTokens);

    await prisma.aiCall.create({
      data: {
        userId: opts.userId,
        feature: opts.feature,
        model,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        estimatedCostCents: costCents
      }
    });

    return { body: text, model };
  } catch (err) {
    // Silent fallback: log to stderr for dev, return null for caller cascade.
    console.error("[ai] generation failed:", err);
    return null;
  }
}

/** True when ANTHROPIC_API_KEY is set; false otherwise. */
export function isAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function aiSpendThisMonth(userId: string, tz: string) {
  const spend = await monthlySpendCents(userId, tz);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiMonthlyCapCents: true }
  });
  const cap = user?.aiMonthlyCapCents ?? 500;
  return { spendCents: spend, capCents: cap, capHit: spend >= cap };
}
