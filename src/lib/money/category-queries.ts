import { prisma } from "@/lib/db";

export type CategoryRow = {
  id: string;
  name: string;
  color: string;
  monthlyLimitCents: number;
  archived: boolean;
};

export async function listCategories(
  userId: string,
  opts: { includeArchived?: boolean } = {}
): Promise<CategoryRow[]> {
  return prisma.budgetCategory.findMany({
    where: {
      userId,
      ...(opts.includeArchived ? {} : { archived: false })
    },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      monthlyLimitCents: true,
      archived: true
    }
  });
}
