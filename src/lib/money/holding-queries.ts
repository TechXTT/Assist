import { prisma } from "@/lib/db";

export type HoldingRow = {
  id: string;
  accountId: string;
  ticker: string;
  name: string | null;
  shares: string; // serialized Decimal — Prisma returns Decimal at runtime
  avgCostCents: number | null;
  lastKnownPriceCents: number;
  lastPriceUpdate: Date;
  notes: string | null;
};

/**
 * List holdings for a single account. Ownership is verified by the caller
 * via the existing account guard; this helper is read-only.
 */
export async function listHoldings(accountId: string): Promise<HoldingRow[]> {
  const rows = await prisma.holding.findMany({
    where: { accountId },
    orderBy: [{ ticker: "asc" }],
    select: {
      id: true,
      accountId: true,
      ticker: true,
      name: true,
      shares: true,
      avgCostCents: true,
      lastKnownPriceCents: true,
      lastPriceUpdate: true,
      notes: true
    }
  });

  return rows.map((r) => ({
    ...r,
    shares: r.shares.toString()
  }));
}

/** All holdings for a user, grouped by accountId. Used by the Net Worth tab. */
export async function listAllHoldings(userId: string): Promise<HoldingRow[]> {
  const rows = await prisma.holding.findMany({
    where: { account: { userId } },
    orderBy: [{ accountId: "asc" }, { ticker: "asc" }],
    select: {
      id: true,
      accountId: true,
      ticker: true,
      name: true,
      shares: true,
      avgCostCents: true,
      lastKnownPriceCents: true,
      lastPriceUpdate: true,
      notes: true
    }
  });

  return rows.map((r) => ({
    ...r,
    shares: r.shares.toString()
  }));
}
