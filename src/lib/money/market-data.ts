import { env } from "@/lib/env";

const QUOTE_URL = "https://api.twelvedata.com/quote";
const REQUEST_TIMEOUT_MS = 8000;

export type Quote = {
  ticker: string;
  priceCents: number;
  currency: string | null;
};

export class MarketDataUnavailableError extends Error {
  constructor(message = "TWELVE_DATA_API_KEY is not set.") {
    super(message);
    this.name = "MarketDataUnavailableError";
  }
}

export function isMarketDataAvailable(): boolean {
  return Boolean(env.TWELVE_DATA_API_KEY);
}

type TwelveDataResponse =
  | {
      symbol: string;
      close?: string;
      currency?: string;
    }
  | { code: number; message: string; status: string };

function parsePriceToCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  if (!isMarketDataAvailable()) throw new MarketDataUnavailableError();

  const url = `${QUOTE_URL}?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(env.TWELVE_DATA_API_KEY)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as TwelveDataResponse;
    if ("code" in data && "message" in data) {
      console.warn(`[market-data] Twelve Data error for ${symbol}:`, data.message);
      return null;
    }
    const priceCents = parsePriceToCents(data.close);
    if (priceCents === null) return null;
    return {
      ticker: data.symbol ?? symbol,
      priceCents,
      currency: data.currency ?? null
    };
  } catch (err) {
    console.warn(`[market-data] fetch failed for ${symbol}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch quotes for a list of tickers, one at a time to stay under the
 * Twelve Data free-tier rate cap (8 req/min). Returns a map keyed by ticker
 * with only the successful lookups.
 */
export async function fetchQuotes(tickers: string[]): Promise<Map<string, Quote>> {
  const out = new Map<string, Quote>();
  const unique = Array.from(new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean)));
  for (const ticker of unique) {
    const q = await fetchQuote(ticker);
    if (q) out.set(ticker, q);
    // Light rate-limit gap. 7.5s spacing → ~8 req/min ceiling.
    if (unique.length > 1) await new Promise((r) => setTimeout(r, 7500));
  }
  return out;
}
