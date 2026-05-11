import { generateText } from "@/lib/ai/client";
import { RECEIPT_SCAN_SYSTEM_PROMPT } from "@/lib/ai/prompts";

export type ParsedReceipt = {
  isReceipt: boolean;
  amountCents: number | null;
  currency: string | null;
  occurredAt: Date | null;
  merchant: string | null;
  category: string | null;
};

const BODY_CHAR_LIMIT = 6000;

function clampBody(s: string): string {
  if (s.length <= BODY_CHAR_LIMIT) return s;
  return s.slice(0, BODY_CHAR_LIMIT);
}

function tryParseJson(raw: string): unknown {
  // Models occasionally wrap JSON in fences despite the rule. Strip them.
  const trimmed = raw.trim();
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function asInt(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v);
}

function asDate(v: unknown): Date | null {
  const s = asString(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function parseReceiptViaAI(opts: {
  userId: string;
  subject: string | null;
  from: string | null;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  allowedCategories: string[];
}): Promise<ParsedReceipt | null> {
  const body = opts.bodyText.trim() || opts.bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const userPayload = JSON.stringify({
    subject: opts.subject ?? "",
    from: opts.from ?? "",
    snippet: opts.snippet,
    body: clampBody(body),
    allowedCategories: opts.allowedCategories
  });

  const result = await generateText({
    userId: opts.userId,
    feature: "receipt_scan",
    systemPrompt: RECEIPT_SCAN_SYSTEM_PROMPT,
    userPayload,
    maxTokens: 200
  });
  if (!result) return null;

  const parsed = tryParseJson(result.body);
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const isReceipt = obj.isReceipt === true;
  const category = asString(obj.category);
  return {
    isReceipt,
    amountCents: asInt(obj.amountCents),
    currency: asString(obj.currency),
    occurredAt: asDate(obj.occurredAt),
    merchant: asString(obj.merchant),
    category: category && opts.allowedCategories.includes(category) ? category : null
  };
}
