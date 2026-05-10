import { prisma } from "@/lib/db";

export type FinancialAccountRow = {
  id: string;
  name: string;
  type: string;
  isLiability: boolean;
  balanceCents: number;
  currency: string;
  includeInNetWorth: boolean;
  archived: boolean;
  notes: string | null;
  updatedAt: Date;
  latestSnapshotAt: Date | null;
};

export async function listFinancialAccounts(
  userId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<FinancialAccountRow[]> {
  const rows = await prisma.financialAccount.findMany({
    where: {
      userId,
      ...(opts.includeArchived ? {} : { archived: false })
    },
    orderBy: [{ archived: "asc" }, { isLiability: "asc" }, { type: "asc" }, { balanceCents: "desc" }],
    select: {
      id: true,
      name: true,
      type: true,
      isLiability: true,
      balanceCents: true,
      currency: true,
      includeInNetWorth: true,
      archived: true,
      notes: true,
      updatedAt: true,
      snapshots: {
        orderBy: { takenAt: "desc" },
        take: 1,
        select: { takenAt: true }
      }
    }
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    isLiability: r.isLiability,
    balanceCents: r.balanceCents,
    currency: r.currency,
    includeInNetWorth: r.includeInNetWorth,
    archived: r.archived,
    notes: r.notes,
    updatedAt: r.updatedAt,
    latestSnapshotAt: r.snapshots[0]?.takenAt ?? null
  }));
}

export type SnapshotRow = {
  id: string;
  balanceCents: number;
  takenAt: Date;
  note: string | null;
};

export async function listSnapshots(
  userId: string,
  accountId: string
): Promise<SnapshotRow[]> {
  // Ownership check via account.userId — keeps the helper safe even if
  // callers forget to require ownership themselves.
  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId },
    select: { id: true }
  });
  if (!account) return [];

  return prisma.balanceSnapshot.findMany({
    where: { accountId },
    orderBy: { takenAt: "desc" },
    select: { id: true, balanceCents: true, takenAt: true, note: true }
  });
}
