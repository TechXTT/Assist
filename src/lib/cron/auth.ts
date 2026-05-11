import { env } from "@/lib/env";

/**
 * Verifies a cron-route request carries the shared secret. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>` automatically when the env var is set
 * in the project. Returns true when authorized.
 */
export function isAuthorizedCron(req: Request): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.CRON_SECRET}`;
  return header === expected;
}
