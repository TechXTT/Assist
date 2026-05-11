import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireBankingSession } from "@/lib/banking/session";
import {
  isBankingAvailable,
  startAuth
} from "@/lib/banking/enablebanking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/banking/connect?aspspName=...&aspspCountry=NL
 *
 * Starts an Enable Banking auth session for the chosen ASPSP, persists a
 * pending BankConnection, and 302s the browser to the bank's consent page.
 * After consent, the bank → Enable Banking → /api/banking/callback?code=...
 */
export async function GET(req: Request) {
  const session = await requireBankingSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isBankingAvailable()) {
    return NextResponse.json({ error: "Banking not configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const aspspName = url.searchParams.get("aspspName");
  const aspspCountry = (url.searchParams.get("aspspCountry") || "").toUpperCase();
  if (!aspspName || !/^[A-Z]{2}$/.test(aspspCountry)) {
    return NextResponse.json(
      { error: "Missing aspspName or aspspCountry." },
      { status: 400 }
    );
  }

  const baseUrl = env.NEXTAUTH_URL.replace(/\/$/, "");
  const redirectUrl = `${baseUrl}/api/banking/callback`;
  const validUntilDays = 90;

  try {
    const auth = await startAuth({
      aspspName,
      aspspCountry,
      redirectUrl,
      state: `${session.userId}-${Date.now()}`,
      validUntilDays
    });

    await prisma.bankConnection.create({
      data: {
        userId: session.userId,
        // Enable Banking issues a session_id only after the callback; until then
        // the authorization_id is the only opaque handle we have. Store it in
        // requisitionId temporarily — the callback overwrites it with session_id.
        requisitionId: auth.authorization_id,
        agreementId: null,
        institutionId: `${aspspName}::${aspspCountry}`,
        institutionName: aspspName,
        status: "pending",
        expiresAt: new Date(Date.now() + validUntilDays * 24 * 60 * 60 * 1000)
      }
    });

    return NextResponse.redirect(auth.url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[banking/connect] failed:", message);
    return NextResponse.redirect(
      new URL(`/settings?banking=error&msg=${encodeURIComponent(message)}`, req.url)
    );
  }
}
