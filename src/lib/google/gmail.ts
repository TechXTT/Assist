import { google, type gmail_v1 } from "googleapis";

import { getValidAccessToken } from "@/lib/google/auth";
import { ReauthRequiredError } from "@/lib/google/errors";

export type GmailMessageSummary = {
  id: string;
  threadId: string | null;
};

export type GmailMessage = {
  id: string;
  threadId: string | null;
  snippet: string;
  from: string | null;
  to: string | null;
  subject: string | null;
  internalDate: Date | null;
  bodyText: string;
  bodyHtml: string;
};

function statusCode(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  return (err as { code?: number }).code;
}

function isQuotaExceeded(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if (statusCode(err) !== 403) return false;
  const message = (err as { message?: string }).message ?? "";
  return /quota/i.test(message) || /rateLimit/i.test(message);
}

function buildClient(accessToken: string): gmail_v1.Gmail {
  const oauth = new google.auth.OAuth2();
  oauth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth });
}

async function withClient<T>(userId: string, fn: (client: gmail_v1.Gmail) => Promise<T>): Promise<T> {
  let accessToken = await getValidAccessToken(userId);
  let triedReauth = false;
  let triedQuota = false;

  while (true) {
    try {
      return await fn(buildClient(accessToken));
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
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64").toString("utf8");
}

function escapeHeader(value: string): string {
  // Strip CR/LF to prevent header injection. RFC-2822 forbids them in unstructured headers.
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildRawMessage(opts: {
  to: string;
  from?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}): string {
  const headers: string[] = [];
  if (opts.from) headers.push(`From: ${escapeHeader(opts.from)}`);
  headers.push(`To: ${escapeHeader(opts.to)}`);
  headers.push(`Subject: ${escapeHeader(opts.subject)}`);
  headers.push("MIME-Version: 1.0");

  let body: string;
  if (opts.bodyHtml) {
    const boundary = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    body = [
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.bodyText,
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 7bit",
      "",
      opts.bodyHtml,
      `--${boundary}--`,
      ""
    ].join("\r\n");
  } else {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: 7bit");
    body = opts.bodyText;
  }

  const raw = headers.join("\r\n") + "\r\n\r\n" + body;
  return toBase64Url(Buffer.from(raw, "utf8"));
}

export async function sendEmail(
  userId: string,
  opts: { to: string; from?: string; subject: string; bodyText: string; bodyHtml?: string }
): Promise<{ id: string; threadId: string | null }> {
  const raw = buildRawMessage(opts);
  return withClient(userId, async (client) => {
    const res = await client.users.messages.send({
      userId: "me",
      requestBody: { raw }
    });
    return { id: res.data.id ?? "", threadId: res.data.threadId ?? null };
  });
}

export async function listRecentMessages(
  userId: string,
  opts: { query: string; maxResults?: number }
): Promise<GmailMessageSummary[]> {
  return withClient(userId, async (client) => {
    const res = await client.users.messages.list({
      userId: "me",
      q: opts.query,
      maxResults: opts.maxResults ?? 25
    });
    return (res.data.messages ?? []).map((m) => ({
      id: m.id ?? "",
      threadId: m.threadId ?? null
    }));
  });
}

function decodePart(part: gmail_v1.Schema$MessagePart | undefined, mime: string): string {
  if (!part) return "";
  if (part.mimeType === mime && part.body?.data) {
    return fromBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const found = decodePart(child, mime);
    if (found) return found;
  }
  return "";
}

function findHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const lowered = name.toLowerCase();
  for (const h of headers) {
    if ((h.name ?? "").toLowerCase() === lowered) return h.value ?? null;
  }
  return null;
}

export async function getMessage(userId: string, messageId: string): Promise<GmailMessage> {
  return withClient(userId, async (client) => {
    const res = await client.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full"
    });
    const payload = res.data.payload;
    const headers = payload?.headers;
    const internalMs = res.data.internalDate ? Number(res.data.internalDate) : null;
    return {
      id: res.data.id ?? messageId,
      threadId: res.data.threadId ?? null,
      snippet: res.data.snippet ?? "",
      from: findHeader(headers, "From"),
      to: findHeader(headers, "To"),
      subject: findHeader(headers, "Subject"),
      internalDate: internalMs ? new Date(internalMs) : null,
      bodyText: decodePart(payload ?? undefined, "text/plain"),
      bodyHtml: decodePart(payload ?? undefined, "text/html")
    };
  });
}
