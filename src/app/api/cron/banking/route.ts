import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron/auth";
import { isBankingAvailable } from "@/lib/banking/enablebanking";
import { syncAllConnections } from "@/lib/banking/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isBankingAvailable()) {
    return NextResponse.json(
      { error: "ENABLE_BANKING_APPLICATION_ID / ENABLE_BANKING_PRIVATE_KEY_BASE64 not set" },
      { status: 503 }
    );
  }
  try {
    const result = await syncAllConnections();
    return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[cron/banking] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
