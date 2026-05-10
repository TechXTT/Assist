import { google, type calendar_v3 } from "googleapis";

import { getValidAccessToken } from "@/lib/google/auth";
import { ReauthRequiredError } from "@/lib/google/errors";

export type NormalizedEvent = {
  googleEventId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  location: string | null;
  description: string | null;
  htmlLink: string | null;
  status: string;
  timeZone: string | null;
};

function isQuotaExceeded(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: number }).code;
  if (code !== 403) return false;
  const message = (err as { message?: string }).message ?? "";
  return /quota/i.test(message) || /rateLimit/i.test(message);
}

function statusCode(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  return (err as { code?: number }).code;
}

function buildClient(accessToken: string) {
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth });
}

function normalize(event: calendar_v3.Schema$Event): NormalizedEvent | null {
  if (!event.id) return null;
  const allDay = Boolean(event.start?.date && !event.start?.dateTime);

  let startsAt: Date;
  let endsAt: Date;
  if (allDay) {
    // Google all-day uses inclusive start, exclusive end (YYYY-MM-DD strings, UTC midnight).
    startsAt = new Date(`${event.start!.date}T00:00:00.000Z`);
    endsAt = new Date(`${event.end!.date}T00:00:00.000Z`);
  } else if (event.start?.dateTime && event.end?.dateTime) {
    startsAt = new Date(event.start.dateTime);
    endsAt = new Date(event.end.dateTime);
  } else {
    return null;
  }

  return {
    googleEventId: event.id,
    title: event.summary ?? "(untitled)",
    startsAt,
    endsAt,
    allDay,
    location: event.location ?? null,
    description: event.description ?? null,
    htmlLink: event.htmlLink ?? null,
    status: event.status ?? "confirmed",
    timeZone: event.start?.timeZone ?? null
  };
}

async function fetchPage(
  client: calendar_v3.Calendar,
  rangeStart: Date,
  rangeEnd: Date,
  pageToken?: string
) {
  return client.events.list({
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    timeMin: rangeStart.toISOString(),
    timeMax: rangeEnd.toISOString(),
    maxResults: 2500,
    pageToken
  });
}

/**
 * List events on the user's primary calendar within a window. Handles token
 * refresh on 401 (one retry) and one backoff retry on quota/rate-limit 403.
 */
export async function listEvents(
  userId: string,
  opts: { rangeStart: Date; rangeEnd: Date }
): Promise<NormalizedEvent[]> {
  let accessToken = await getValidAccessToken(userId);
  let triedReauth = false;
  let triedQuota = false;
  const out: NormalizedEvent[] = [];
  let pageToken: string | undefined;

  while (true) {
    let client = buildClient(accessToken);
    try {
      const res = await fetchPage(client, opts.rangeStart, opts.rangeEnd, pageToken);
      for (const event of res.data.items ?? []) {
        const norm = normalize(event);
        if (norm) out.push(norm);
      }
      pageToken = res.data.nextPageToken ?? undefined;
      if (!pageToken) break;
    } catch (err) {
      if (statusCode(err) === 401 && !triedReauth) {
        triedReauth = true;
        accessToken = await getValidAccessToken(userId);
        continue;
      }
      if (statusCode(err) === 401) {
        throw new ReauthRequiredError();
      }
      if (isQuotaExceeded(err) && !triedQuota) {
        triedQuota = true;
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      throw err;
    }
  }

  return out;
}
