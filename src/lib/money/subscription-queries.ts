import { prisma } from "@/lib/db";

export type SubscriptionRow = {
  id: string;
  name: string;
  amountCents: number;
  currency: string;
  billingCycle: string; // "monthly" | "annual"
  nextChargeAt: Date;
  category: string | null;
  userMarkedUnused: boolean;
  lastReminderShownAt: Date | null;
};

export async function listSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  return prisma.subscription.findMany({
    where: { userId },
    orderBy: { nextChargeAt: "asc" },
    select: {
      id: true,
      name: true,
      amountCents: true,
      currency: true,
      billingCycle: true,
      nextChargeAt: true,
      category: true,
      userMarkedUnused: true,
      lastReminderShownAt: true
    }
  });
}
