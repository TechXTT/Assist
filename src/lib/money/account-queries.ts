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

  // Detail fields (all optional, all from 4J)
  rateBps: number | null;
  originalPrincipalCents: number | null;
  monthlyPaymentCents: number | null;
  loanTermMonths: number | null;
  loanStartedAt: Date | null;
  creditLimitCents: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  institution: string | null;
  trackHoldings: boolean;
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
      rateBps: true,
      originalPrincipalCents: true,
      monthlyPaymentCents: true,
      loanTermMonths: true,
      loanStartedAt: true,
      creditLimitCents: true,
      statementDay: true,
      paymentDueDay: true,
      institution: true,
      trackHoldings: true,
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
    rateBps: r.rateBps,
    originalPrincipalCents: r.originalPrincipalCents,
    monthlyPaymentCents: r.monthlyPaymentCents,
    loanTermMonths: r.loanTermMonths,
    loanStartedAt: r.loanStartedAt,
    creditLimitCents: r.creditLimitCents,
    statementDay: r.statementDay,
    paymentDueDay: r.paymentDueDay,
    institution: r.institution,
    trackHoldings: r.trackHoldings,
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
