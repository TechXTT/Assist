import { prisma } from "@/lib/db";

import { currentMonth } from "@/lib/money/period";

export type NetWorthSnapshot = {
  totalCents: number;
  assetCents: number;
  liabilityCents: number;
  byType: Record<string, { totalCents: number; isLiability: boolean }>;
};

export type HistoryPoint = { at: Date; totalCents: number };

/**
 * Compute the user's current net worth from their FinancialAccount rows.
 * Only non-archived + includeInNetWorth = true accounts contribute. Liabilities
 * are subtracted; balanceCents is always non-negative in the DB.
 */
export async function calculateNetWorth(userId: string): Promise<NetWorthSnapshot> {
  const accounts = await prisma.financialAccount.findMany({
    where: { userId, archived: false, includeInNetWorth: true },
    select: { type: true, balanceCents: true, isLiability: true }
  });

  let assetCents = 0;
  let liabilityCents = 0;
  const byType: NetWorthSnapshot["byType"] = {};

  for (const a of accounts) {
    if (a.isLiability) liabilityCents += a.balanceCents;
    else assetCents += a.balanceCents;

    const bucket = byType[a.type] ?? { totalCents: 0, isLiability: a.isLiability };
    bucket.totalCents += a.balanceCents;
    // If this type has both asset and liability accounts (shouldn't happen
    // in practice), the slice flips to whichever side is dominant.
    if (a.isLiability !== bucket.isLiability && a.balanceCents > bucket.totalCents) {
      bucket.isLiability = a.isLiability;
    }
    byType[a.type] = bucket;
  }

  return {
    totalCents: assetCents - liabilityCents,
    assetCents,
    liabilityCents,
    byType
  };
}

type SnapshotJoin = {
  takenAt: Date;
  balanceCents: number;
  account: { id: string; isLiability: boolean };
};

async function fetchHistorySnapshots(
  userId: string,
  range: { from?: Date; to?: Date } = {}
): Promise<SnapshotJoin[]> {
  return prisma.balanceSnapshot.findMany({
    where: {
      account: {
        userId,
        archived: false,
        includeInNetWorth: true
      },
      ...(range.from || range.to
        ? {
            takenAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {})
            }
          }
        : {})
    },
    orderBy: { takenAt: "asc" },
    select: {
      takenAt: true,
      balanceCents: true,
      account: { select: { id: true, isLiability: true } }
    }
  });
}

/**
 * Walk the user's snapshot history and emit a running net worth at each
 * point. The series is a step function — net worth only "changes" when an
 * account got a new snapshot. The chart connects points with lines but no
 * interpolation is implied.
 *
 * Note: only accounts that are currently non-archived + includeInNetWorth
 * appear in the history. Toggling those flags redraws the chart, matching
 * the headline rule.
 */
export async function netWorthHistory(
  userId: string,
  range: { from?: Date; to?: Date } = {}
): Promise<HistoryPoint[]> {
  const snapshots = await fetchHistorySnapshots(userId, range);
  if (snapshots.length === 0) return [];

  const balances = new Map<string, { balanceCents: number; isLiability: boolean }>();
  const points: HistoryPoint[] = [];

  for (const s of snapshots) {
    balances.set(s.account.id, {
      balanceCents: s.balanceCents,
      isLiability: s.account.isLiability
    });
    let total = 0;
    for (const v of balances.values()) {
      total += v.isLiability ? -v.balanceCents : v.balanceCents;
    }
    points.push({ at: s.takenAt, totalCents: total });
  }

  return points;
}

/**
 * Net worth at a specific point in time, computed by replaying snapshots up
 * to that date. Used for the start-of-month delta on the dashboard card.
 * Returns null if the user has no snapshots before that date.
 */
export async function netWorthAtDate(userId: string, asOf: Date): Promise<number | null> {
  const snapshots = await fetchHistorySnapshots(userId, { to: asOf });
  if (snapshots.length === 0) return null;

  const balances = new Map<string, { balanceCents: number; isLiability: boolean }>();
  for (const s of snapshots) {
    balances.set(s.account.id, {
      balanceCents: s.balanceCents,
      isLiability: s.account.isLiability
    });
  }
  let total = 0;
  for (const v of balances.values()) {
    total += v.isLiability ? -v.balanceCents : v.balanceCents;
  }
  return total;
}

/**
 * Convenience for the dashboard line: current net worth + delta vs. the
 * value at the start of the current month in the user's tz. Returns null
 * when the user has zero included accounts.
 */
export async function netWorthDashboardSummary(
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<{ totalCents: number; deltaThisMonthCents: number } | null> {
  const accountsExist = await prisma.financialAccount.count({
    where: { userId, archived: false, includeInNetWorth: true }
  });
  if (accountsExist === 0) return null;

  const { totalCents } = await calculateNetWorth(userId);
  const month = currentMonth(timezone, now);
  const startOfMonthValue = await netWorthAtDate(userId, month.start);
  const deltaThisMonthCents =
    startOfMonthValue === null ? 0 : totalCents - startOfMonthValue;
  return { totalCents, deltaThisMonthCents };
}
