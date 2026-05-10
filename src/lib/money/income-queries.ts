import { prisma } from "@/lib/db";

export type IncomeSourceRow = {
  id: string;
  name: string;
  expectedAmountCents: number;
  currency: string;
  cadence: string;
  cadenceAnchorDay: number | null;
  nextExpectedAt: Date;
  category: string;
  active: boolean;
  lastReceivedAt: Date | null;
  notes: string | null;
};

export async function listIncomeSources(
  userId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<IncomeSourceRow[]> {
  return prisma.incomeSource.findMany({
    where: {
      userId,
      ...(opts.includeArchived ? {} : { active: true })
    },
    orderBy: [{ active: "desc" }, { nextExpectedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      expectedAmountCents: true,
      currency: true,
      cadence: true,
      cadenceAnchorDay: true,
      nextExpectedAt: true,
      category: true,
      active: true,
      lastReceivedAt: true,
      notes: true
    }
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Soonest active income source whose nextExpectedAt is within the given
 * horizon. Used by the dashboard "Next: ..." line.
 */
export async function nextExpectedSoon(
  userId: string,
  withinDays: number,
  now: Date = new Date()
) {
  const horizon = new Date(now.getTime() + withinDays * DAY_MS);
  return prisma.incomeSource.findFirst({
    where: {
      userId,
      active: true,
      nextExpectedAt: { gte: now, lte: horizon }
    },
    orderBy: { nextExpectedAt: "asc" },
    select: {
      id: true,
      name: true,
      expectedAmountCents: true,
      nextExpectedAt: true
    }
  });
}
