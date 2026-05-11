import { createSign, createPrivateKey, type KeyObject } from "node:crypto";

import { env } from "@/lib/env";
import {
  BankingApiError,
  BankingNotConfiguredError
} from "@/lib/banking/errors";

const BASE_URL = "https://api.enablebanking.com";
const JWT_TTL_SECONDS = 3600;

let cachedPrivateKey: KeyObject | null = null;

export function isBankingAvailable(): boolean {
  return Boolean(env.ENABLE_BANKING_APPLICATION_ID && env.ENABLE_BANKING_PRIVATE_KEY_BASE64);
}

function loadPrivateKey(): KeyObject {
  if (cachedPrivateKey) return cachedPrivateKey;
  if (!env.ENABLE_BANKING_PRIVATE_KEY_BASE64) throw new BankingNotConfiguredError();
  const pem = Buffer.from(env.ENABLE_BANKING_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  cachedPrivateKey = createPrivateKey(pem);
  return cachedPrivateKey;
}

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeJwt(): string {
  if (!isBankingAvailable()) throw new BankingNotConfiguredError();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(
    Buffer.from(
      JSON.stringify({ typ: "JWT", alg: "RS256", kid: env.ENABLE_BANKING_APPLICATION_ID })
    )
  );
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        iss: "enablebanking.com",
        aud: "api.enablebanking.com",
        iat: now,
        exp: now + JWT_TTL_SECONDS
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = base64Url(signer.sign(loadPrivateKey()));
  return `${signingInput}.${signature}`;
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${makeJwt()}`);
  headers.set("accept", "application/json");
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
    }
    throw new BankingApiError(`Enable Banking ${path} → ${res.status}`, res.status, body);
  }
  return (await res.json()) as T;
}

// ----- Types -----

export type Aspsp = {
  name: string;
  country: string;
  logo?: string | null;
  beta?: boolean;
  sandbox?: boolean;
  psu_types?: string[];
  auth_methods?: Array<{ name: string; title?: string }>;
  maximum_consent_validity?: number;
};

export type AuthStart = {
  url: string;
  authorization_id: string;
  psu_id_hash?: string;
};

export type SessionResponse = {
  session_id: string;
  access: { valid_until: string };
  aspsp: { name: string; country: string };
  accounts: string[];
  accounts_data?: Array<{
    uid: string;
    identification_hash: string;
    identifiers?: { iban?: string };
    account_name?: string;
    currency?: string;
  }>;
};

export type EnableBankingTransaction = {
  entry_reference?: string;
  transaction_id?: string;
  transaction_amount: { amount: string; currency: string };
  credit_debit_indicator?: "CRDT" | "DBIT";
  status?: "BOOK" | "PDNG";
  booking_date?: string;
  value_date?: string;
  transaction_date?: string;
  remittance_information?: string[];
  creditor?: { name?: string };
  debtor?: { name?: string };
  bank_transaction_code?: { description?: string };
};

export type AccountTransactions = {
  transactions: EnableBankingTransaction[];
  continuation_key?: string | null;
};

// ----- Public API -----

export async function listAspsps(opts: { country?: string } = {}): Promise<Aspsp[]> {
  const qs = opts.country ? `?country=${encodeURIComponent(opts.country)}` : "";
  const res = await apiFetch<{ aspsps: Aspsp[] }>(`/aspsps${qs}`);
  return res.aspsps;
}

export async function startAuth(opts: {
  aspspName: string;
  aspspCountry: string;
  redirectUrl: string;
  state: string;
  validUntilDays?: number;
  psuType?: "personal" | "business";
}): Promise<AuthStart> {
  const validUntilDays = opts.validUntilDays ?? 90;
  const validUntil = new Date(Date.now() + validUntilDays * 24 * 60 * 60 * 1000).toISOString();
  return apiFetch<AuthStart>("/auth", {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: validUntil },
      aspsp: { name: opts.aspspName, country: opts.aspspCountry },
      state: opts.state,
      redirect_url: opts.redirectUrl,
      psu_type: opts.psuType ?? "personal"
    })
  });
}

export async function createSession(code: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify({ code })
  });
}

export async function getSession(sessionId: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch<unknown>(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE"
  });
}

export async function getAccountTransactions(
  accountId: string,
  opts: { dateFrom?: string; continuationKey?: string } = {}
): Promise<AccountTransactions> {
  const params = new URLSearchParams();
  if (opts.dateFrom) params.set("date_from", opts.dateFrom);
  if (opts.continuationKey) params.set("continuation_key", opts.continuationKey);
  const qs = params.toString();
  return apiFetch<AccountTransactions>(
    `/accounts/${encodeURIComponent(accountId)}/transactions${qs ? `?${qs}` : ""}`
  );
}
