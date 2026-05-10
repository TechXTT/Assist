/**
 * Format an integer-cents amount in the given ISO currency code.
 * Sign is preserved — negative values render with a leading minus.
 */
export function formatCents(cents: number, currency: string): string {
  const sign = cents < 0 ? -1 : 1;
  const abs = Math.abs(cents);
  const value = (abs / 100) * sign;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    currencyDisplay: "symbol"
  }).format(value);
}

/**
 * Parse a free-form money string into integer cents. Accepts:
 *   "12,34", "12.34", "12", "1.234,50", "1,234.50", "$12.34", "€12,34"
 * Returns null on un-parseable input. Empty string returns null.
 */
export function parseCentsInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const negative = /^-/.test(trimmed);
  const cleaned = trimmed
    .replace(/^-/, "")
    .replace(/[^\d.,]/g, "");
  if (!cleaned) return null;

  // If the string contains both '.' and ',', the rightmost is the decimal
  // separator. Otherwise treat ',' the same as '.'.
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    const decimalIdx = Math.max(lastComma, lastDot);
    normalized =
      cleaned.slice(0, decimalIdx).replace(/[.,]/g, "") +
      "." +
      cleaned.slice(decimalIdx + 1).replace(/[.,]/g, "");
  } else if (cleaned.includes(",")) {
    // Single comma: treat as decimal separator if followed by 1-2 digits, else as thousands.
    const idx = cleaned.lastIndexOf(",");
    const decimalPart = cleaned.slice(idx + 1);
    if (decimalPart.length <= 2 && !decimalPart.includes(",")) {
      normalized = cleaned.slice(0, idx).replace(/,/g, "") + "." + decimalPart;
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  return negative ? -cents : cents;
}
