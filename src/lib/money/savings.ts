export type InterestProjection =
  | { kind: "computable"; annualInterestCents: number; monthlyInterestCents: number }
  | { kind: "missing_data" };

/**
 * Simple-interest projection (no monthly compounding).
 *   annual = balance · rateBps / 10000
 *   monthly = annual / 12
 *
 * Footnote in the UI: estimate, assumes balance stays constant.
 */
export function projectInterest(input: {
  balanceCents: number;
  rateBps: number | null;
}): InterestProjection {
  if (!input.rateBps || input.balanceCents <= 0) return { kind: "missing_data" };
  const annualInterestCents = Math.round((input.balanceCents * input.rateBps) / 10_000);
  const monthlyInterestCents = Math.round(annualInterestCents / 12);
  return { kind: "computable", annualInterestCents, monthlyInterestCents };
}
