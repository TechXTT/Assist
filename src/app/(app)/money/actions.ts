"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { nextDueAt } from "@/lib/money/bill-utils";
import { advanceCycle } from "@/lib/money/subscription-utils";
import {
  deleteRemindersForBill,
  upsertReminderForBill
} from "@/lib/reminders/bills";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  color: z.string().regex(HEX_COLOR, "Pick a color.").default("#7c9885"),
  monthlyLimitCents: z.number().int().nonnegative().default(0)
});

const renameCategorySchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40)
});

const createBudgetSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  color: z.string().regex(HEX_COLOR, "Pick a color.").default("#7c9885"),
  monthlyLimitCents: z.number().int().positive("Set a limit above zero.")
});

const updateBudgetSchema = z.object({
  color: z.string().regex(HEX_COLOR, "Pick a color.").optional(),
  monthlyLimitCents: z.number().int().positive("Set a limit above zero.").optional()
});

const createBillSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(60),
    amountCents: z.number().int().positive("Set an amount above zero."),
    currency: z.string().min(1).default(env.DEFAULT_CURRENCY),
    category: z.string().trim().max(40).optional().nullable(),
    recurring: z.boolean(),
    dueDay: z.number().int().min(1).max(31).optional().nullable(),
    dueDate: z.string().optional().nullable(), // ISO date-only or datetime
    reminderEnabled: z.boolean().default(true),
    notes: z.string().trim().max(500).optional().nullable()
  })
  .refine(
    (v) => (v.recurring ? typeof v.dueDay === "number" : Boolean(v.dueDate)),
    { message: "Pick a due day or due date." }
  );

const updateBillSchema = createBillSchema.innerType().partial();

const createSubscriptionSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60),
  amountCents: z.number().int().positive("Set an amount above zero."),
  currency: z.string().min(1).default(env.DEFAULT_CURRENCY),
  billingCycle: z.enum(["monthly", "annual"]),
  nextChargeAt: z.string().min(1, "Pick a date."),
  category: z.string().trim().max(40).optional().nullable()
});

const updateSubscriptionSchema = createSubscriptionSchema.partial();

const createTransactionSchema = z.object({
  amountCents: z.number().int(),
  currency: z.string().min(1).default(env.DEFAULT_CURRENCY),
  description: z.string().trim().max(200).optional().nullable(),
  category: z.string().trim().max(40).optional().nullable(),
  occurredAt: z.string().min(1) // ISO from datetime-local; required.
});

const updateTransactionSchema = createTransactionSchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !session.user.id) throw new Error("Not signed in.");
  if (session.user.email !== env.ALLOWED_EMAIL) throw new Error("Forbidden.");
  return session as typeof session & { user: { id: string; email: string } };
}

async function requireOwnedCategory(id: string, userId: string) {
  const cat = await prisma.budgetCategory.findUnique({
    where: { id },
    select: { id: true, userId: true, name: true }
  });
  if (!cat || cat.userId !== userId) throw new Error("Category not found.");
  return cat;
}

async function requireOwnedTransaction(id: string, userId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id },
    select: { id: true, userId: true, category: true }
  });
  if (!tx || tx.userId !== userId) throw new Error("Transaction not found.");
  return tx;
}

async function requireOwnedSubscription(id: string, userId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      billingCycle: true,
      nextChargeAt: true
    }
  });
  if (!sub || sub.userId !== userId) throw new Error("Subscription not found.");
  return sub;
}

async function requireOwnedBill(id: string, userId: string) {
  const bill = await prisma.bill.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      recurring: true,
      dueDay: true,
      dueDate: true,
      lastPaidAt: true,
      reminderEnabled: true
    }
  });
  if (!bill || bill.userId !== userId) throw new Error("Bill not found.");
  return bill;
}

function revalidate() {
  revalidatePath("/money");
  revalidatePath("/dashboard");
}

function parseOccurredAt(input: string): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date.");
  return d;
}

// ----- Categories -----

export async function createCategory(input: CreateCategoryInput) {
  const session = await requireSession();
  const data = createCategorySchema.parse(input);

  const existing = await prisma.budgetCategory.findFirst({
    where: { userId: session.user.id, name: data.name }
  });
  if (existing) {
    if (existing.archived) {
      // Restore + update color/limit if the user is "creating" a name that's archived.
      await prisma.budgetCategory.update({
        where: { id: existing.id },
        data: {
          archived: false,
          color: data.color,
          monthlyLimitCents: data.monthlyLimitCents
        }
      });
      revalidate();
      return { id: existing.id };
    }
    throw new Error("A category with that name already exists.");
  }

  const created = await prisma.budgetCategory.create({
    data: {
      userId: session.user.id,
      name: data.name,
      color: data.color,
      monthlyLimitCents: data.monthlyLimitCents
    }
  });
  revalidate();
  return { id: created.id };
}

export async function renameCategory(id: string, input: { name: string }) {
  const session = await requireSession();
  const data = renameCategorySchema.parse(input);
  const existing = await requireOwnedCategory(id, session.user.id);

  if (existing.name === data.name) return;

  // Cascade-rename: keep historical transactions tagged with the new name.
  await prisma.$transaction([
    prisma.budgetCategory.update({
      where: { id },
      data: { name: data.name }
    }),
    prisma.transaction.updateMany({
      where: { userId: session.user.id, category: existing.name },
      data: { category: data.name }
    })
  ]);
  revalidate();
}

export async function setCategoryColor(id: string, color: string) {
  const session = await requireSession();
  await requireOwnedCategory(id, session.user.id);
  if (!HEX_COLOR.test(color)) throw new Error("Pick a color.");
  await prisma.budgetCategory.update({ where: { id }, data: { color } });
  revalidate();
}

export async function archiveCategory(id: string) {
  const session = await requireSession();
  await requireOwnedCategory(id, session.user.id);
  await prisma.budgetCategory.update({ where: { id }, data: { archived: true } });
  revalidate();
}

export async function unarchiveCategory(id: string) {
  const session = await requireSession();
  await requireOwnedCategory(id, session.user.id);
  await prisma.budgetCategory.update({ where: { id }, data: { archived: false } });
  revalidate();
}

// ----- Budgets -----
//
// A "budget" is a BudgetCategory with monthlyLimitCents > 0.
// createBudget upserts by name (matching the brief: name "must match an
// existing or new category"); archived rows with the same name are
// restored. updateBudget edits limit + color. archiveBudget archives the
// whole category — the confirm dialog warns about the picker side-effect.

export async function createBudget(input: CreateBudgetInput) {
  const session = await requireSession();
  const data = createBudgetSchema.parse(input);

  const existing = await prisma.budgetCategory.findFirst({
    where: { userId: session.user.id, name: data.name }
  });

  if (existing) {
    if (!existing.archived && existing.monthlyLimitCents > 0) {
      throw new Error("That category already has a budget — edit it instead.");
    }
    await prisma.budgetCategory.update({
      where: { id: existing.id },
      data: {
        archived: false,
        color: data.color,
        monthlyLimitCents: data.monthlyLimitCents
      }
    });
    revalidate();
    return { id: existing.id };
  }

  const created = await prisma.budgetCategory.create({
    data: {
      userId: session.user.id,
      name: data.name,
      color: data.color,
      monthlyLimitCents: data.monthlyLimitCents
    }
  });
  revalidate();
  return { id: created.id };
}

export async function updateBudget(id: string, input: UpdateBudgetInput) {
  const session = await requireSession();
  const data = updateBudgetSchema.parse(input);
  await requireOwnedCategory(id, session.user.id);

  await prisma.budgetCategory.update({
    where: { id },
    data: {
      ...(typeof data.color === "string" && { color: data.color }),
      ...(typeof data.monthlyLimitCents === "number" && {
        monthlyLimitCents: data.monthlyLimitCents
      })
    }
  });
  revalidate();
}

export async function archiveBudget(id: string) {
  const session = await requireSession();
  await requireOwnedCategory(id, session.user.id);
  await prisma.budgetCategory.update({ where: { id }, data: { archived: true } });
  revalidate();
}

// ----- Transactions -----

export async function createTransaction(input: CreateTransactionInput) {
  const session = await requireSession();
  const data = createTransactionSchema.parse(input);

  const created = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      amountCents: data.amountCents,
      currency: data.currency,
      description: data.description?.trim() || "",
      category: data.category?.trim() || null,
      occurredAt: parseOccurredAt(data.occurredAt),
      source: "manual"
    }
  });
  revalidate();
  return { id: created.id };
}

export async function updateTransaction(id: string, input: UpdateTransactionInput) {
  const session = await requireSession();
  const data = updateTransactionSchema.parse(input);
  await requireOwnedTransaction(id, session.user.id);

  await prisma.transaction.update({
    where: { id },
    data: {
      ...(typeof data.amountCents === "number" && { amountCents: data.amountCents }),
      ...(typeof data.currency === "string" && { currency: data.currency }),
      ...(typeof data.description !== "undefined" && {
        description: data.description?.trim() || ""
      }),
      ...(typeof data.category !== "undefined" && {
        category: data.category?.trim() || null
      }),
      ...(typeof data.occurredAt === "string" && {
        occurredAt: parseOccurredAt(data.occurredAt)
      })
    }
  });
  revalidate();
}

export async function deleteTransaction(id: string) {
  const session = await requireSession();
  await requireOwnedTransaction(id, session.user.id);
  await prisma.transaction.delete({ where: { id } });
  revalidate();
}

// ----- Bills -----

function parseDueDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function regenerateBillReminder(billId: string, userId: string, timezone: string) {
  await deleteRemindersForBill(billId);
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    select: {
      reminderEnabled: true,
      recurring: true,
      dueDay: true,
      dueDate: true,
      lastPaidAt: true
    }
  });
  if (!bill || !bill.reminderEnabled) return;
  const due = nextDueAt(bill, timezone);
  if (!due) return;
  await upsertReminderForBill(billId, userId, due);
}

async function userTimezone(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true }
  });
  return u?.timezone || env.DEFAULT_TIMEZONE;
}

export async function createBill(input: CreateBillInput) {
  const session = await requireSession();
  const data = createBillSchema.parse(input);
  const tz = await userTimezone(session.user.id);

  const created = await prisma.bill.create({
    data: {
      userId: session.user.id,
      name: data.name,
      amountCents: data.amountCents,
      currency: data.currency,
      category: data.category?.trim() || null,
      recurring: data.recurring,
      dueDay: data.recurring ? (data.dueDay ?? null) : null,
      dueDate: !data.recurring ? parseDueDate(data.dueDate) : null,
      reminderEnabled: data.reminderEnabled,
      notes: data.notes?.trim() || null,
      source: "manual"
    }
  });

  await regenerateBillReminder(created.id, session.user.id, tz);
  revalidate();
  return { id: created.id };
}

export async function updateBill(id: string, input: UpdateBillInput) {
  const session = await requireSession();
  const data = updateBillSchema.parse(input);
  await requireOwnedBill(id, session.user.id);
  const tz = await userTimezone(session.user.id);

  const recurringPatch: Partial<{
    recurring: boolean;
    dueDay: number | null;
    dueDate: Date | null;
  }> = {};
  if (typeof data.recurring === "boolean") {
    recurringPatch.recurring = data.recurring;
    recurringPatch.dueDay = data.recurring ? (data.dueDay ?? null) : null;
    recurringPatch.dueDate = !data.recurring ? parseDueDate(data.dueDate ?? null) : null;
  } else {
    if (typeof data.dueDay !== "undefined") recurringPatch.dueDay = data.dueDay ?? null;
    if (typeof data.dueDate !== "undefined")
      recurringPatch.dueDate = parseDueDate(data.dueDate ?? null);
  }

  await prisma.bill.update({
    where: { id },
    data: {
      ...(typeof data.name === "string" && { name: data.name }),
      ...(typeof data.amountCents === "number" && { amountCents: data.amountCents }),
      ...(typeof data.currency === "string" && { currency: data.currency }),
      ...(typeof data.category !== "undefined" && {
        category: data.category?.trim() || null
      }),
      ...recurringPatch,
      ...(typeof data.reminderEnabled === "boolean" && {
        reminderEnabled: data.reminderEnabled
      }),
      ...(typeof data.notes !== "undefined" && { notes: data.notes?.trim() || null })
    }
  });

  await regenerateBillReminder(id, session.user.id, tz);
  revalidate();
}

export async function markBillPaid(id: string) {
  const session = await requireSession();
  await requireOwnedBill(id, session.user.id);
  const tz = await userTimezone(session.user.id);

  await prisma.bill.update({
    where: { id },
    data: { lastPaidAt: new Date() }
  });

  // Pending reminders point at the cycle that just ended; clear and regenerate
  // for the next cycle (recurring) or just clear (one-off).
  await regenerateBillReminder(id, session.user.id, tz);
  revalidate();
}

export async function deleteBill(id: string) {
  const session = await requireSession();
  await requireOwnedBill(id, session.user.id);
  await deleteRemindersForBill(id);
  await prisma.bill.delete({ where: { id } });
  revalidate();
}

// ----- Subscriptions -----

function parseChargeAt(input: string): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date.");
  return d;
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const session = await requireSession();
  const data = createSubscriptionSchema.parse(input);

  const created = await prisma.subscription.create({
    data: {
      userId: session.user.id,
      name: data.name,
      amountCents: data.amountCents,
      currency: data.currency,
      billingCycle: data.billingCycle,
      nextChargeAt: parseChargeAt(data.nextChargeAt),
      category: data.category?.trim() || null,
      source: "manual"
    }
  });
  revalidate();
  return { id: created.id };
}

export async function updateSubscription(id: string, input: UpdateSubscriptionInput) {
  const session = await requireSession();
  const data = updateSubscriptionSchema.parse(input);
  await requireOwnedSubscription(id, session.user.id);

  await prisma.subscription.update({
    where: { id },
    data: {
      ...(typeof data.name === "string" && { name: data.name }),
      ...(typeof data.amountCents === "number" && { amountCents: data.amountCents }),
      ...(typeof data.currency === "string" && { currency: data.currency }),
      ...(typeof data.billingCycle === "string" && { billingCycle: data.billingCycle }),
      ...(typeof data.nextChargeAt === "string" && {
        nextChargeAt: parseChargeAt(data.nextChargeAt)
      }),
      ...(typeof data.category !== "undefined" && {
        category: data.category?.trim() || null
      })
    }
  });
  revalidate();
}

export async function markSubscriptionCharged(id: string) {
  const session = await requireSession();
  const sub = await requireOwnedSubscription(id, session.user.id);
  const next = advanceCycle(sub.nextChargeAt, sub.billingCycle);
  await prisma.subscription.update({
    where: { id },
    data: { nextChargeAt: next }
  });
  revalidate();
}

export async function setSubscriptionUnused(id: string, unused: boolean) {
  const session = await requireSession();
  await requireOwnedSubscription(id, session.user.id);
  await prisma.subscription.update({
    where: { id },
    data: {
      userMarkedUnused: unused,
      // Clearing the flag also clears the snooze timestamp so the hint
      // doesn't surface stale data if the user toggles back later.
      ...(unused ? {} : { lastReminderShownAt: null })
    }
  });
  revalidate();
}

/**
 * Snooze the cancel hint for ~one cycle. Set when user clicks "Yeah, I'll
 * cancel" — the hint stays gone for 30 days, then resurfaces.
 */
export async function snoozeCancelHint(id: string) {
  const session = await requireSession();
  await requireOwnedSubscription(id, session.user.id);
  await prisma.subscription.update({
    where: { id },
    data: { lastReminderShownAt: new Date() }
  });
  revalidate();
}

export async function deleteSubscription(id: string) {
  const session = await requireSession();
  await requireOwnedSubscription(id, session.user.id);
  await prisma.subscription.delete({ where: { id } });
  revalidate();
}
