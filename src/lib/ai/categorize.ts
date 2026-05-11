import { generateText } from "@/lib/ai/client";
import { CATEGORIZE_TRANSACTION_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export type CategorySuggestion = {
  category: string;
  confidence: "high" | "medium" | "low";
};

function tryParseJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export async function suggestCategoryViaAI(opts: {
  userId: string;
  description: string;
  amountCents: number;
  sign: "expense" | "income";
  allowedCategories: string[];
}): Promise<CategorySuggestion | null> {
  if (opts.allowedCategories.length === 0) return null;
  if (opts.description.trim().length < 3) return null;

  const userPayload = JSON.stringify({
    description: opts.description.trim().slice(0, 200),
    amountCents: opts.amountCents,
    sign: opts.sign,
    allowedCategories: opts.allowedCategories
  });

  const result = await generateText({
    userId: opts.userId,
    feature: "categorize_transaction",
    systemPrompt: CATEGORIZE_TRANSACTION_SYSTEM_PROMPT,
    userPayload,
    maxTokens: 80
  });
  if (!result) return null;

  const parsed = tryParseJson(result.body);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const category = typeof obj.category === "string" ? obj.category.trim() : null;
  if (!category || !opts.allowedCategories.includes(category)) return null;

  const confidence =
    obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low"
      ? obj.confidence
      : "low";
  if (confidence === "low") return null;

  return { category, confidence };
}
