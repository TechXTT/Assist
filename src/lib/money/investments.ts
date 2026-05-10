/**
 * Holding shape used by the math helpers. `shares` is a stringified
 * decimal so callers can pass values that came from Prisma's Decimal type
 * without forcing a runtime dependency on decimal.js here.
 */
export type HoldingForMath = {
  shares: string | number;
  avgCostCents: number | null;
  lastKnownPriceCents: number;
};

function sharesAsNumber(shares: string | number): number {
  if (typeof shares === "number") return shares;
  const parsed = Number.parseFloat(shares);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Position value in cents: shares × lastKnownPriceCents, rounded to integer cents. */
export function positionValue(holding: HoldingForMath): number {
  const s = sharesAsNumber(holding.shares);
  return Math.round(s * holding.lastKnownPriceCents);
}

/**
 * Absolute + ratio gain/loss vs. cost basis. Null when no avgCostCents is
 * tracked (since the gain/loss is undefined).
 */
export function positionGainLoss(
  holding: HoldingForMath
): { absoluteCents: number; ratio: number } | null {
  if (holding.avgCostCents === null || holding.avgCostCents === undefined) return null;
  const s = sharesAsNumber(holding.shares);
  const costCents = Math.round(s * holding.avgCostCents);
  const valueCents = positionValue(holding);
  const absoluteCents = valueCents - costCents;
  const ratio = costCents > 0 ? absoluteCents / costCents : 0;
  return { absoluteCents, ratio };
}

/** Sum of positionValue across all holdings on an account. */
export function accountValueFromHoldings(holdings: HoldingForMath[]): number {
  let total = 0;
  for (const h of holdings) total += positionValue(h);
  return total;
}

/**
 * Aggregate gain/loss across all holdings that have a cost basis. Holdings
 * without a basis are skipped (so the aggregate represents only positions
 * the user is actively tracking cost on).
 */
export function aggregateGainLoss(
  holdings: HoldingForMath[]
): { absoluteCents: number; ratio: number } | null {
  let totalCost = 0;
  let totalValue = 0;
  let any = false;
  for (const h of holdings) {
    if (h.avgCostCents === null || h.avgCostCents === undefined) continue;
    const s = sharesAsNumber(h.shares);
    totalCost += Math.round(s * h.avgCostCents);
    totalValue += positionValue(h);
    any = true;
  }
  if (!any) return null;
  const absoluteCents = totalValue - totalCost;
  const ratio = totalCost > 0 ? absoluteCents / totalCost : 0;
  return { absoluteCents, ratio };
}
