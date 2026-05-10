import { prisma } from "@/lib/db";

export type GoalRow = {
  id: string;
  name: string;
  targetCents: number;
  savedCents: number;
  targetDate: Date | null;
  notes: string | null;
  archived: boolean;
  createdAt: Date;
};

export async function listGoals(
  userId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<GoalRow[]> {
  return prisma.savingsGoal.findMany({
    where: {
      userId,
      ...(opts.includeArchived ? {} : { archived: false })
    },
    orderBy: [{ archived: "asc" }, { targetDate: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      targetCents: true,
      savedCents: true,
      targetDate: true,
      notes: true,
      archived: true,
      createdAt: true
    }
  });
}
