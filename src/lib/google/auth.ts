import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { NotConnectedError, ReauthRequiredError } from "@/lib/google/errors";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REFRESH_MARGIN_MS = 60_000;

type GoogleAccount = {
  id: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
};

async function loadGoogleAccount(userId: string): Promise<GoogleAccount> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { id: true, refresh_token: true, access_token: true, expires_at: true }
  });
  if (!account) throw new NotConnectedError();
  return account;
}

async function markReauthRequired(userId: string, accountId: string) {
  await prisma.$transaction([
    prisma.account.update({
      where: { id: accountId },
      data: { access_token: null }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { googleNeedsReauth: true }
    })
  ]);
}

/**
 * Returns a non-expired Google access token for the user, refreshing via the
 * stored refresh_token if needed. Throws ReauthRequiredError when refresh fails
 * (token revoked, scopes changed, etc.).
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await loadGoogleAccount(userId);
  const nowSec = Math.floor(Date.now() / 1000);

  if (account.access_token && account.expires_at && account.expires_at * 1000 - REFRESH_MARGIN_MS > Date.now()) {
    return account.access_token;
  }

  if (!account.refresh_token) {
    await markReauthRequired(userId, account.id);
    throw new ReauthRequiredError();
  }

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: account.refresh_token
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    await markReauthRequired(userId, account.id);
    throw new ReauthRequiredError();
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope?: string;
    token_type?: string;
  };

  await prisma.account.update({
    where: { id: account.id },
    data: {
      access_token: data.access_token,
      expires_at: nowSec + data.expires_in,
      // Google occasionally returns a new refresh_token on rotation — keep the latest.
      ...(data.refresh_token ? { refresh_token: data.refresh_token } : {})
    }
  });

  return data.access_token;
}

/**
 * Removes the Google connection for the user: deletes the Account row,
 * wipes cached calendar events, and clears reauth flags.
 */
export async function disconnectGoogle(userId: string) {
  await prisma.$transaction([
    prisma.account.deleteMany({ where: { userId, provider: "google" } }),
    prisma.calendarEvent.deleteMany({ where: { userId } }),
    prisma.user.update({
      where: { id: userId },
      data: { lastCalendarSyncAt: null, googleNeedsReauth: false }
    })
  ]);
}

export { NotConnectedError, ReauthRequiredError };
