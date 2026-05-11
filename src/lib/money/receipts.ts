import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { listRecentMessages, getMessage } from "@/lib/google/gmail";
import { buildReceiptQuery } from "@/lib/money/receipt-senders";
import { parseReceiptViaAI } from "@/lib/ai/receipt-parser";

export type ScanResult = {
  scanned: number;
  draftsCreated: number;
  skippedAlreadyKnown: number;
  skippedNotReceipt: number;
  capHit: boolean;
};

export async function scanRecentReceipts(
  userId: string,
  opts: { days?: number; maxResults?: number } = {}
): Promise<ScanResult> {
  const days = opts.days ?? 7;
  const maxResults = opts.maxResults ?? 25;

  const query = buildReceiptQuery({ days });
  const summaries = await listRecentMessages(userId, { query, maxResults });

  let draftsCreated = 0;
  let skippedAlreadyKnown = 0;
  let skippedNotReceipt = 0;
  let capHit = false;

  // Pre-load known message ids and category names once.
  const ids = summaries.map((s) => s.id).filter(Boolean);
  const [existingDrafts, existingTxs, categories] = await Promise.all([
    prisma.receiptDraft.findMany({
      where: { userId, gmailMessageId: { in: ids } },
      select: { gmailMessageId: true }
    }),
    prisma.transaction.findMany({
      where: { userId, sourceMessageId: { in: ids } },
      select: { sourceMessageId: true }
    }),
    prisma.budgetCategory.findMany({
      where: { userId, archived: false },
      select: { name: true }
    })
  ]);
  const known = new Set<string>([
    ...existingDrafts.map((d) => d.gmailMessageId),
    ...existingTxs.map((t) => t.sourceMessageId).filter((s): s is string => Boolean(s))
  ]);
  const allowedCategories = categories.map((c) => c.name);

  for (const summary of summaries) {
    if (!summary.id) continue;
    if (known.has(summary.id)) {
      skippedAlreadyKnown++;
      continue;
    }

    const message = await getMessage(userId, summary.id);
    const parsed = await parseReceiptViaAI({
      userId,
      subject: message.subject,
      from: message.from,
      snippet: message.snippet,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      allowedCategories
    });

    if (parsed === null) {
      // generateText returned null → cap hit, key missing, or SDK error. Stop scanning.
      capHit = true;
      break;
    }

    if (!parsed.isReceipt) {
      skippedNotReceipt++;
      continue;
    }

    await prisma.receiptDraft.create({
      data: {
        userId,
        gmailMessageId: summary.id,
        snippet: message.snippet.slice(0, 500),
        parsedAmountCents: parsed.amountCents,
        parsedCurrency: parsed.currency ?? env.DEFAULT_CURRENCY,
        parsedDate: parsed.occurredAt ?? message.internalDate,
        parsedMerchant: parsed.merchant,
        suggestedCategory: parsed.category,
        status: "pending"
      }
    });
    draftsCreated++;
  }

  return {
    scanned: summaries.length,
    draftsCreated,
    skippedAlreadyKnown,
    skippedNotReceipt,
    capHit
  };
}

export async function listPendingDrafts(userId: string) {
  return prisma.receiptDraft.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" }
  });
}

export type ApproveDraftInput = {
  amountCents: number;
  currency: string;
  description: string;
  category: string | null;
  occurredAt: Date;
};

export async function approveDraft(
  userId: string,
  draftId: string,
  override: ApproveDraftInput
): Promise<{ transactionId: string }> {
  const draft = await prisma.receiptDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.userId !== userId) throw new Error("Draft not found.");
  if (draft.status !== "pending") throw new Error("Draft already resolved.");

  const tx = await prisma.transaction.create({
    data: {
      userId,
      amountCents: override.amountCents,
      currency: override.currency,
      description: override.description,
      category: override.category,
      occurredAt: override.occurredAt,
      source: "gmail",
      sourceMessageId: draft.gmailMessageId,
      sourceMessageSnippet: draft.snippet
    }
  });

  await prisma.receiptDraft.update({
    where: { id: draftId },
    data: { status: "approved" }
  });

  return { transactionId: tx.id };
}

export async function rejectDraft(userId: string, draftId: string) {
  const draft = await prisma.receiptDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.userId !== userId) throw new Error("Draft not found.");
  if (draft.status !== "pending") return;
  await prisma.receiptDraft.update({
    where: { id: draftId },
    data: { status: "rejected" }
  });
}
