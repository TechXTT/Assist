// Rough per-model rates in cents-per-million tokens. Updated from
// Anthropic's public pricing page; these are deliberate approximations
// (the cap counter is a guide, not billing — see brief §12).
//
// Adjust here if pricing shifts or new models are added.
export const MODEL_PRICING: Record<
  string,
  { inputCentsPerMillion: number; outputCentsPerMillion: number }
> = {
  // Haiku 4.5 — the default for all v1 AI features.
  "claude-haiku-4-5-20251001": {
    inputCentsPerMillion: 100, // $1.00 per million input tokens
    outputCentsPerMillion: 500 // $5.00 per million output tokens
  }
};

export function estimateCostCents(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const rate = MODEL_PRICING[model];
  if (!rate) return 0;
  const inputCost = (promptTokens / 1_000_000) * rate.inputCentsPerMillion;
  const outputCost = (completionTokens / 1_000_000) * rate.outputCentsPerMillion;
  return Math.max(1, Math.round(inputCost + outputCost));
}
