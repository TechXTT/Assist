import { format } from "date-fns";

import { prisma } from "@/lib/db";
import {
  deleteSession,
  type EnableBankingTransaction,
  getAccountTransactions,
  getSession
} from "@/lib/banking/enablebanking";
import { BankingApiError } from "@/lib/banking/errors";

export type SyncResult = {
  inserted: number;
  skippedDuplicates: number;
  accountsScanned: number;
  reason?: "expired" | "rejected" | "error";
  errorMessage?: string;
};

function parseAmountCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T12:00:00.000Z`);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function describe(tx: EnableBankingTransaction): string {
  const remit = tx.remittance_information?.join(" ").trim();
  return (
    remit ||
    tx.creditor?.name?.trim() ||
    tx.debtor?.name?.trim() ||
    "Bank transaction"
  ).slice(0, 200);
}

function signedAmountCents(tx: EnableBankingTransaction): number | null {
  const raw = parseAmountCents(tx.transaction_amount.amount);
  if (raw === null) return null;
  // Enable Banking returns absolute amounts plus a credit_debit_indicator.
  // Our Transaction.amountCents is signed: negative = expense.
  if (tx.credit_debit_indicator === "DBIT") return -Math.abs(raw);
  if (tx.credit_debit_indicator === "CRDT") return Math.abs(raw);
  // No indicator → assume signed already (some ASPSPs send negatives directly).
  return raw;
}

function externalIdFor(tx: EnableBankingTransaction, accountId: string): string {
  const id = tx.transaction_id ?? tx.entry_reference;
  if (id) return `${accountId}:${id}`;
  const datePart = tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? "";
  return `${accountId}:${datePart}:${tx.transaction_amount.amount}:${tx.creditor?.name ?? tx.debtor?.name ?? ""}`;
}

export async function syncBankConnection(connectionId: string): Promise<SyncResult> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId }
  });
  if (!connection) throw new Error("Connection not found.");
  if (connection.status !== "active") {
    return {
      inserted: 0,
      skippedDuplicates: 0,
      accountsScanned: 0,
      reason: connection.status === "expired" ? "expired" : "error",
      errorMessage: `connection.status=${connection.status}`
    };
  }

  let accounts: string[] = [];
  try {
    accounts = connection.accountsJson ? (JSON.parse(connection.accountsJson) as string[]) : [];
  } catch {
    /* ignore */
  }

  // Refresh the session and validate it's still alive.
  try {
    const fresh = await getSession(connection.requisitionId);
    if (fresh.accounts && fresh.accounts.length > 0 && fresh.accounts.length !== accounts.length) {
      accounts = fresh.accounts;
      await prisma.bankConnection.update({
        where: { id: connectionId },
        data: { accountsJson: JSON.stringify(accounts) }
      });
    }
  } catch (err) {
    if (err instanceof BankingApiError && (err.status === 404 || err.status === 401)) {
      await prisma.bankConnection.update({
        where: { id: connectionId },
        data: { status: "expired" }
      });
      return { inserted: 0, skippedDuplicates: 0, accountsScanned: 0, reason: "expired" };
    }
    throw err;
  }

  const dateFrom = connection.lastSyncedAt
    ? format(connection.lastSyncedAt, "yyyy-MM-dd")
    : undefined;

  let inserted = 0;
  let skippedDuplicates = 0;

  for (const accountId of accounts) {
    let response;
    try {
      response = await getAccountTransactions(accountId, { dateFrom });
    } catch (err) {
      console.warn(`[banking/sync] fetch failed for account ${accountId}:`, err);
      continue;
    }

    // Enable Banking returns booked + pending intermixed; filter to booked only.
    const booked = response.transactions.filter(
      (t) => !t.status || t.status === "BOOK"
    );
    if (booked.length === 0) continue;

    const externalIds = booked.map((tx) => externalIdFor(tx, accountId));
    const existing = await prisma.transaction.findMany({
      where: {
        userId: connection.userId,
        source: { startsWith: "bank:" },
        externalId: { in: externalIds }
      },
      select: { externalId: true }
    });
    const known = new Set(existing.map((e) => e.externalId).filter((s): s is string => Boolean(s)));

    for (const tx of booked) {
      const externalId = externalIdFor(tx, accountId);
      if (known.has(externalId)) {
        skippedDuplicates++;
        continue;
      }
      const amountCents = signedAmountCents(tx);
      if (amountCents === null) continue;
      const occurredAt =
        parseDate(tx.booking_date ?? tx.value_date ?? tx.transaction_date) ?? new Date();

      await prisma.transaction.create({
        data: {
          userId: connection.userId,
          amountCents,
          currency: tx.transaction_amount.currency || "EUR",
          description: describe(tx),
          category: null,
          occurredAt,
          source: `bank:${connection.institutionName.toLowerCase()}`,
          externalId,
          bankConnectionId: connection.id
        }
      });
      inserted++;
    }
  }

  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { lastSyncedAt: new Date() }
  });

  return { inserted, skippedDuplicates, accountsScanned: accounts.length };
}

export async function syncAllConnections(): Promise<{
  connections: number;
  totalInserted: number;
  totalSkipped: number;
  expired: number;
  failed: number;
}> {
  const active = await prisma.bankConnection.findMany({
    where: { status: "active" },
    select: { id: true }
  });
  let totalInserted = 0;
  let totalSkipped = 0;
  let expired = 0;
  let failed = 0;
  for (const c of active) {
    try {
      const r = await syncBankConnection(c.id);
      totalInserted += r.inserted;
      totalSkipped += r.skippedDuplicates;
      if (r.reason === "expired" || r.reason === "rejected") expired++;
    } catch (err) {
      console.error(`[banking/sync] connection ${c.id} failed:`, err);
      failed++;
    }
  }
  return { connections: active.length, totalInserted, totalSkipped, expired, failed };
}

export async function disconnectBankConnection(
  userId: string,
  connectionId: string
): Promise<void> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId }
  });
  if (!connection || connection.userId !== userId) throw new Error("Connection not found.");

  // Best-effort: revoke the Enable Banking session. Swallow 404 (already gone).
  try {
    await deleteSession(connection.requisitionId);
  } catch (err) {
    if (!(err instanceof BankingApiError && err.status === 404)) {
      console.warn("[banking/disconnect] deleteSession failed:", err);
    }
  }

  // Keep historical Transaction rows (bankConnectionId set to null via schema's
  // onDelete: SetNull). Delete only the connection itself.
  await prisma.bankConnection.delete({ where: { id: connectionId } });
}
