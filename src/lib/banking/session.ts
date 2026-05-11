import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { env } from "@/lib/env";

export type BankingSession = { userId: string; email: string };

/**
 * Server-side session guard for banking routes. Rejects with null when no
 * session exists or the user doesn't match ALLOWED_EMAIL. Route handlers
 * map a null return to a redirect to /login.
 */
export async function requireBankingSession(): Promise<BankingSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;
  if (session.user.email !== env.ALLOWED_EMAIL) return null;
  return { userId: session.user.id, email: session.user.email };
}
