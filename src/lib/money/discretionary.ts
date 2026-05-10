import { differenceInCalendarDays } from "date-fns";

import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_HISTORY_DAYS = 14;

export type DiscretionaryAuto = {
  cents: number; // 0 when not enough history
  basedOnDays: number;
  basedOnTxCount: number;
};

/**
 * Trailing-N-day average daily expense, excluding income-source receipts.
 *
 * Gating: if the earliest qualifying transaction is less than
 * MIN_HISTORY_DAYS old, returns 0 — the UI shows a hint instead of an
 * unreliable estimate based on a few days of spending.
 */
export async function computeDiscretionaryDaily(
  userId: string,
  lookbackDays = 60,
  now: Date = new Date()
): Promise<DiscretionaryAuto> {
  const from = new Date(now.getTime() - lookbackDays * DAY_MS);

  const [aggregate, earliest] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        userId,
        amountCents: { lt: 0 },
        source: { not: "income-source" },
        occurredAt: { gte: from, lte: now }
      },
      _sum: { amountCents: true },
      _count: true
    }),
    prisma.transaction.findFirst({
      where: {
        userId,
        amountCents: { lt: 0 },
        source: { not: "income-source" }
      },
      orderBy: { occurredAt: "asc" },
      select: { occurredAt: true }
    })
  ]);

  const txCount = aggregate._count ?? 0;
  if (!earliest) {
    return { cents: 0, basedOnDays: 0, basedOnTxCount: txCount };
  }

  const daysOfHistory = Math.max(0, differenceInCalendarDays(now, earliest.occurredAt));
  if (daysOfHistory < MIN_HISTORY_DAYS) {
    return { cents: 0, basedOnDays: daysOfHistory, basedOnTxCount: txCount };
  }

  const totalAbs = Math.abs(aggregate._sum.amountCents ?? 0);
  const cents = Math.round(totalAbs / lookbackDays);
  return { cents, basedOnDays: lookbackDays, basedOnTxCount: txCount };
}
