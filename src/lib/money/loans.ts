import { addMonths } from "date-fns";

export type PayoffProjection =
  | {
      kind: "computable";
      monthsRemaining: number;
      payoffDate: Date;
      totalInterestProjectedCents: number;
    }
  | { kind: "payment_too_low" }
  | { kind: "missing_data"; missing: string[] };

export type PayoffInput = {
  balanceCents: number;
  rateBps: number | null;
  monthlyPaymentCents: number | null;
};

/**
 * Project loan payoff using the standard amortization formula.
 *   n = -ln(1 - r·B/P) / ln(1 + r)
 * Returns a tagged union so the UI can render different states cleanly.
 */
export function projectPayoff(input: PayoffInput, now: Date = new Date()): PayoffProjection {
  const missing: string[] = [];
  if (!input.balanceCents || input.balanceCents <= 0) missing.push("balance");
  if (input.rateBps === null || input.rateBps === undefined) missing.push("rate");
  if (!input.monthlyPaymentCents || input.monthlyPaymentCents <= 0) missing.push("monthlyPayment");
  if (missing.length > 0) return { kind: "missing_data", missing };

  const balance = input.balanceCents!;
  const payment = input.monthlyPaymentCents!;
  const monthlyRate = (input.rateBps! / 10_000) / 12;

  const monthlyInterest = balance * monthlyRate;
  if (payment <= monthlyInterest) return { kind: "payment_too_low" };

  // n = -ln(1 - r·B/P) / ln(1 + r)
  // When r === 0 (no interest), n = B / P.
  let n: number;
  if (monthlyRate === 0) {
    n = balance / payment;
  } else {
    n = -Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate);
  }
  const monthsRemaining = Math.ceil(n);
  const payoffDate = addMonths(now, monthsRemaining);
  const totalInterestProjectedCents = Math.max(0, monthsRemaining * payment - balance);

  return {
    kind: "computable",
    monthsRemaining,
    payoffDate,
    totalInterestProjectedCents
  };
}

/**
 * Fraction paid down based on original principal. Returns null when the
 * original principal isn't tracked.
 */
export function paidDownRatio(
  balanceCents: number,
  originalPrincipalCents: number | null
): number | null {
  if (!originalPrincipalCents || originalPrincipalCents <= 0) return null;
  return Math.max(0, Math.min(1, 1 - balanceCents / originalPrincipalCents));
}
