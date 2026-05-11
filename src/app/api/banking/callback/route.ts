import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireBankingSession } from "@/lib/banking/session";
import {
  createSession,
  isBankingAvailable
} from "@/lib/banking/enablebanking";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/banking/callback?code=<one-time>&state=<our state>
 *
 * Enable Banking redirects here after the user completes (or rejects) consent
 * at their bank. We exchange the `code` for a session, persist the session id
 * + accounts list, and redirect to /settings with a status banner.
 */
export async function GET(req: Request) {
  const session = await requireBankingSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isBankingAvailable()) {
    return NextResponse.redirect(new URL("/settings?banking=error", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    // Enable Banking sends ?error=... when the user rejects.
    const err = url.searchParams.get("error") ?? "no-code";
    const pending = await prisma.bankConnection.findFirst({
      where: { userId: session.userId, status: "pending" },
      orderBy: { createdAt: "desc" }
    });
    if (pending) {
      await prisma.bankConnection.update({
        where: { id: pending.id },
        data: { status: "expired" }
      });
    }
    return NextResponse.redirect(
      new URL(`/settings?banking=rejected&msg=${encodeURIComponent(err)}`, req.url)
    );
  }

  // The most recent pending row is the one we just created in /connect.
  const pending = await prisma.bankConnection.findFirst({
    where: { userId: session.userId, status: "pending" },
    orderBy: { createdAt: "desc" }
  });
  if (!pending) {
    return NextResponse.redirect(new URL("/settings?banking=error&msg=no-pending", req.url));
  }

  try {
    const sess = await createSession(code);
    await prisma.bankConnection.update({
      where: { id: pending.id },
      data: {
        status: "active",
        requisitionId: sess.session_id,
        accountsJson: JSON.stringify(sess.accounts),
        expiresAt: sess.access?.valid_until ? new Date(sess.access.valid_until) : pending.expiresAt
      }
    });

    return NextResponse.redirect(
      new URL(`/settings?banking=connected&id=${pending.id}`, req.url)
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[banking/callback] failed:", message);
    await prisma.bankConnection.update({
      where: { id: pending.id },
      data: { status: "expired" }
    });
    return NextResponse.redirect(
      new URL(`/settings?banking=error&msg=${encodeURIComponent(message)}`, req.url)
    );
  }
}
