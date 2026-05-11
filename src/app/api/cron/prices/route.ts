import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron/auth";
import { refreshPricesForAllUsers } from "@/lib/money/refresh-prices";
import {
  isMarketDataAvailable,
  MarketDataUnavailableError
} from "@/lib/money/market-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Twelve Data free tier is rate-limited; ratelimited sync can take several
// minutes when many tickers are tracked. Default Vercel function timeout is
// 10s on Hobby — but cron routes get 60s. We stay within that budget by
// processing sequentially with a small delay.

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isMarketDataAvailable()) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY not set" }, { status: 503 });
  }
  try {
    const result = await refreshPricesForAllUsers();
    return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
  } catch (err) {
    if (err instanceof MarketDataUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[cron/prices] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
