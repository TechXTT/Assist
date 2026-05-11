import { prisma } from "@/lib/db";
import { fetchQuotes, isMarketDataAvailable, MarketDataUnavailableError } from "@/lib/money/market-data";

export type RefreshPricesResult = {
  updated: number;
  unchanged: number;
  failed: string[];
};

export async function refreshPricesForUser(userId: string): Promise<RefreshPricesResult> {
  if (!isMarketDataAvailable()) throw new MarketDataUnavailableError();

  const holdings = await prisma.holding.findMany({
    where: { account: { userId, archived: false } },
    select: { id: true, ticker: true, lastKnownPriceCents: true }
  });
  if (holdings.length === 0) return { updated: 0, unchanged: 0, failed: [] };

  const quotes = await fetchQuotes(holdings.map((h) => h.ticker));

  let updated = 0;
  let unchanged = 0;
  const failed: string[] = [];

  for (const h of holdings) {
    const key = h.ticker.trim().toUpperCase();
    const quote = quotes.get(key);
    if (!quote) {
      failed.push(h.ticker);
      continue;
    }
    if (quote.priceCents === h.lastKnownPriceCents) {
      // Still update the timestamp so the UI shows the fresh check.
      await prisma.holding.update({
        where: { id: h.id },
        data: { lastPriceUpdate: new Date() }
      });
      unchanged++;
      continue;
    }
    await prisma.holding.update({
      where: { id: h.id },
      data: {
        lastKnownPriceCents: quote.priceCents,
        lastPriceUpdate: new Date()
      }
    });
    updated++;
  }

  return { updated, unchanged, failed };
}

export async function refreshPricesForAllUsers(): Promise<{
  users: number;
  totalUpdated: number;
  totalFailed: number;
}> {
  if (!isMarketDataAvailable()) throw new MarketDataUnavailableError();
  const users = await prisma.user.findMany({
    where: {
      financialAccounts: {
        some: {
          archived: false,
          holdings: { some: {} }
        }
      }
    },
    select: { id: true }
  });
  let totalUpdated = 0;
  let totalFailed = 0;
  for (const u of users) {
    try {
      const r = await refreshPricesForUser(u.id);
      totalUpdated += r.updated;
      totalFailed += r.failed.length;
    } catch (err) {
      console.error("[refresh-prices] user failed:", u.id, err);
      totalFailed++;
    }
  }
  return { users: users.length, totalUpdated, totalFailed };
}
