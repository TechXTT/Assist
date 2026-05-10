"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Prisma } from "@prisma/client";

import { nextDueAt } from "@/lib/money/bill-utils";
import { nextDateForCadence } from "@/lib/money/income";
import { accountValueFromHoldings } from "@/lib/money/investments";
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

const createGoalSchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(60),
  targetCents: z.number().int().positive("Set a target above zero."),
  targetDate: z.string().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable()
});

const updateGoalSchema = createGoalSchema.partial();

const addToGoalSchema = z.object({
  cents: z.number().int().positive("Save more than zero.")
});

const CADENCE = z.enum(["monthly", "biweekly", "weekly", "oneoff"]);

const createIncomeSourceSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(60),
    expectedAmountCents: z.number().int().positive("Set an amount above zero."),
    currency: z.string().min(1).default(env.DEFAULT_CURRENCY),
    cadence: CADENCE,
    cadenceAnchorDay: z.number().int().min(1).max(31).optional().nullable(),
    nextExpectedAt: z.string().min(1, "Pick a date."),
    category: z.string().trim().max(40).default("Income"),
    notes: z.string().trim().max(500).optional().nullable()
  })
  .refine(
    (v) => (v.cadence === "monthly" ? typeof v.cadenceAnchorDay === "number" : true),
    { message: "Pick a day of the month.", path: ["cadenceAnchorDay"] }
  );

const updateIncomeSourceSchema = createIncomeSourceSchema.innerType().partial();

const markIncomeReceivedSchema = z.object({
  actualAmountCents: z.number().int().positive().optional(),
  receivedAt: z.string().optional()
});

const ACCOUNT_TYPE = z.enum([
  "cash",
  "savings",
  "investment",
  "crypto",
  "credit",
  "loan",
  "other"
]);

const detailFieldsSchema = z.object({
  rateBps: z.number().int().nonnegative().nullable().optional(),
  originalPrincipalCents: z.number().int().nonnegative().nullable().optional(),
  monthlyPaymentCents: z.number().int().nonnegative().nullable().optional(),
  loanTermMonths: z.number().int().nonnegative().nullable().optional(),
  loanStartedAt: z.string().nullable().optional(),
  creditLimitCents: z.number().int().nonnegative().nullable().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDay: z.number().int().min(1).max(31).nullable().optional(),
  institution: z.string().trim().max(80).nullable().optional()
});

const createFinancialAccountSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(60),
    type: ACCOUNT_TYPE,
    isLiability: z.boolean(),
    balanceCents: z.number().int().nonnegative().default(0),
    currency: z.string().min(1).default(env.DEFAULT_CURRENCY),
    notes: z.string().trim().max(500).optional().nullable(),
    trackHoldings: z.boolean().optional()
  })
  .merge(detailFieldsSchema);

const updateFinancialAccountSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: ACCOUNT_TYPE.optional(),
  isLiability: z.boolean().optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

const updateAccountDetailsSchema = detailFieldsSchema;

const updateAccountBalanceSchema = z.object({
  newBalanceCents: z.number().int().nonnegative(),
  takenAt: z.string().optional(),
  note: z.string().trim().max(200).optional().nullable()
});

const holdingInputSchema = z.object({
  ticker: z.string().trim().min(1).max(20),
  name: z.string().trim().max(80).optional().nullable(),
  shares: z
    .string()
    .min(1, "How many shares?")
    .refine((v) => {
      const n = Number.parseFloat(v);
      return Number.isFinite(n) && n > 0;
    }, "Enter a positive number."),
  avgCostCents: z.number().int().nonnegative().nullable().optional(),
  lastKnownPriceCents: z.number().int().nonnegative(),
  lastPriceUpdate: z.string().optional(),
  notes: z.string().trim().max(500).optional().nullable()
});

const updateHoldingSchema = holdingInputSchema.partial();

const updatePriceSchema = z.object({
  lastKnownPriceCents: z.number().int().nonnegative(),
  lastPriceUpdate: z.string().optional()
});

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
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateIncomeSourceInput = z.infer<typeof createIncomeSourceSchema>;
export type UpdateIncomeSourceInput = z.infer<typeof updateIncomeSourceSchema>;
export type MarkIncomeReceivedInput = z.infer<typeof markIncomeReceivedSchema>;
export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountSchema>;
export type UpdateFinancialAccountInput = z.infer<typeof updateFinancialAccountSchema>;
export type UpdateAccountDetailsInput = z.infer<typeof updateAccountDetailsSchema>;
export type UpdateAccountBalanceInput = z.infer<typeof updateAccountBalanceSchema>;
export type HoldingInput = z.infer<typeof holdingInputSchema>;
export type UpdateHoldingInput = z.infer<typeof updateHoldingSchema>;
export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;
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

async function requireOwnedFinancialAccount(id: string, userId: string) {
  const account = await prisma.financialAccount.findUnique({
    where: { id },
    select: { id: true, userId: true, name: true, balanceCents: true }
  });
  if (!account || account.userId !== userId) throw new Error("Account not found.");
  return account;
}

async function requireOwnedSnapshot(id: string, userId: string) {
  const snapshot = await prisma.balanceSnapshot.findUnique({
    where: { id },
    select: {
      id: true,
      account: { select: { id: true, userId: true } }
    }
  });
  if (!snapshot || snapshot.account.userId !== userId)
    throw new Error("Snapshot not found.");
  return snapshot;
}

async function requireOwnedIncomeSource(id: string, userId: string) {
  const source = await prisma.incomeSource.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      expectedAmountCents: true,
      currency: true,
      cadence: true,
      cadenceAnchorDay: true,
      category: true
    }
  });
  if (!source || source.userId !== userId) throw new Error("Income source not found.");
  return source;
}

async function requireOwnedGoal(id: string, userId: string) {
  const goal = await prisma.savingsGoal.findUnique({
    where: { id },
    select: { id: true, userId: true, targetCents: true, savedCents: true }
  });
  if (!goal || goal.userId !== userId) throw new Error("Goal not found.");
  return goal;
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

// ----- Savings goals -----

function parseTargetDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createGoal(input: CreateGoalInput) {
  const session = await requireSession();
  const data = createGoalSchema.parse(input);

  const created = await prisma.savingsGoal.create({
    data: {
      userId: session.user.id,
      name: data.name,
      targetCents: data.targetCents,
      targetDate: parseTargetDate(data.targetDate),
      notes: data.notes?.trim() || null
    }
  });
  revalidate();
  return { id: created.id };
}

export async function updateGoal(id: string, input: UpdateGoalInput) {
  const session = await requireSession();
  const data = updateGoalSchema.parse(input);
  await requireOwnedGoal(id, session.user.id);

  await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...(typeof data.name === "string" && { name: data.name }),
      ...(typeof data.targetCents === "number" && { targetCents: data.targetCents }),
      ...(typeof data.targetDate !== "undefined" && {
        targetDate: parseTargetDate(data.targetDate)
      }),
      ...(typeof data.notes !== "undefined" && { notes: data.notes?.trim() || null })
    }
  });
  revalidate();
}

export async function addToGoal(id: string, cents: number) {
  const session = await requireSession();
  addToGoalSchema.parse({ cents });
  const goal = await requireOwnedGoal(id, session.user.id);

  await prisma.savingsGoal.update({
    where: { id },
    data: { savedCents: goal.savedCents + cents }
  });
  revalidate();
}

export async function archiveGoal(id: string) {
  const session = await requireSession();
  await requireOwnedGoal(id, session.user.id);
  await prisma.savingsGoal.update({ where: { id }, data: { archived: true } });
  revalidate();
}

export async function unarchiveGoal(id: string) {
  const session = await requireSession();
  await requireOwnedGoal(id, session.user.id);
  await prisma.savingsGoal.update({ where: { id }, data: { archived: false } });
  revalidate();
}

export async function deleteGoal(id: string) {
  const session = await requireSession();
  await requireOwnedGoal(id, session.user.id);
  await prisma.savingsGoal.delete({ where: { id } });
  revalidate();
}

// ----- Income sources -----

function parseExpectedAt(input: string): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date.");
  return d;
}

function parseOptionalDate(input: string | undefined | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createIncomeSource(input: CreateIncomeSourceInput) {
  const session = await requireSession();
  const data = createIncomeSourceSchema.parse(input);

  const created = await prisma.incomeSource.create({
    data: {
      userId: session.user.id,
      name: data.name,
      expectedAmountCents: data.expectedAmountCents,
      currency: data.currency,
      cadence: data.cadence,
      cadenceAnchorDay: data.cadence === "monthly" ? (data.cadenceAnchorDay ?? null) : null,
      nextExpectedAt: parseExpectedAt(data.nextExpectedAt),
      category: data.category?.trim() || "Income",
      notes: data.notes?.trim() || null
    }
  });
  revalidate();
  return { id: created.id };
}

export async function updateIncomeSource(id: string, input: UpdateIncomeSourceInput) {
  const session = await requireSession();
  const data = updateIncomeSourceSchema.parse(input);
  await requireOwnedIncomeSource(id, session.user.id);

  const cadencePatch: Partial<{
    cadence: string;
    cadenceAnchorDay: number | null;
  }> = {};
  if (typeof data.cadence === "string") {
    cadencePatch.cadence = data.cadence;
    cadencePatch.cadenceAnchorDay =
      data.cadence === "monthly" ? (data.cadenceAnchorDay ?? null) : null;
  } else if (typeof data.cadenceAnchorDay !== "undefined") {
    cadencePatch.cadenceAnchorDay = data.cadenceAnchorDay ?? null;
  }

  await prisma.incomeSource.update({
    where: { id },
    data: {
      ...(typeof data.name === "string" && { name: data.name }),
      ...(typeof data.expectedAmountCents === "number" && {
        expectedAmountCents: data.expectedAmountCents
      }),
      ...(typeof data.currency === "string" && { currency: data.currency }),
      ...cadencePatch,
      ...(typeof data.nextExpectedAt === "string" && {
        nextExpectedAt: parseExpectedAt(data.nextExpectedAt)
      }),
      ...(typeof data.category === "string" && {
        category: data.category.trim() || "Income"
      }),
      ...(typeof data.notes !== "undefined" && { notes: data.notes?.trim() || null })
    }
  });
  revalidate();
}

export async function archiveIncomeSource(id: string) {
  const session = await requireSession();
  await requireOwnedIncomeSource(id, session.user.id);
  await prisma.incomeSource.update({ where: { id }, data: { active: false } });
  revalidate();
}

export async function unarchiveIncomeSource(id: string) {
  const session = await requireSession();
  await requireOwnedIncomeSource(id, session.user.id);
  await prisma.incomeSource.update({ where: { id }, data: { active: true } });
  revalidate();
}

export async function markIncomeReceived(id: string, input: MarkIncomeReceivedInput = {}) {
  const session = await requireSession();
  const source = await requireOwnedIncomeSource(id, session.user.id);
  const data = markIncomeReceivedSchema.parse(input);
  const tz = await userTimezone(session.user.id);

  const occurredAt = parseOptionalDate(data.receivedAt) ?? new Date();
  const amountCents = Math.abs(data.actualAmountCents ?? source.expectedAmountCents);

  const nextExpectedAt =
    source.cadence === "oneoff"
      ? null
      : nextDateForCadence(occurredAt, source.cadence, source.cadenceAnchorDay ?? null, tz);

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        amountCents,
        currency: source.currency,
        description: source.name,
        category: source.category,
        occurredAt,
        source: "income-source",
        externalId: source.id
      }
    }),
    prisma.incomeSource.update({
      where: { id },
      data: {
        lastReceivedAt: occurredAt,
        ...(source.cadence === "oneoff"
          ? { active: false }
          : nextExpectedAt
            ? { nextExpectedAt }
            : {})
      }
    })
  ]);

  revalidate();
  return { amountCents, currency: source.currency, nextExpectedAt };
}

export async function deleteIncomeSource(id: string) {
  const session = await requireSession();
  await requireOwnedIncomeSource(id, session.user.id);
  await prisma.incomeSource.delete({ where: { id } });
  revalidate();
}

// ----- Financial accounts (net worth) -----

function parseTakenAt(input: string | null | undefined): Date {
  if (!input) return new Date();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// Allowed detail fields per account type. Used for both validation in
// updateAccountDetails (reject patches with irrelevant fields) and as the
// authoritative shape for the Details section of the account form.
const DETAIL_FIELDS_BY_TYPE: Record<string, ReadonlyArray<keyof DetailFields>> = {
  cash: ["institution"],
  savings: ["rateBps", "institution"],
  investment: ["institution"],
  crypto: ["institution"],
  credit: ["rateBps", "creditLimitCents", "statementDay", "paymentDueDay", "institution"],
  loan: [
    "rateBps",
    "originalPrincipalCents",
    "monthlyPaymentCents",
    "loanTermMonths",
    "loanStartedAt",
    "institution"
  ],
  other: ["institution"]
};

type DetailFields = {
  rateBps: number | null;
  originalPrincipalCents: number | null;
  monthlyPaymentCents: number | null;
  loanTermMonths: number | null;
  loanStartedAt: Date | null;
  creditLimitCents: number | null;
  statementDay: number | null;
  paymentDueDay: number | null;
  institution: string | null;
};

function parseLoanStart(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Build a Prisma-compatible patch from a detail-fields input, filtered to
 * only the fields allowed for the account's type. Fields outside the
 * allowlist throw. Undefined fields (not in the patch) are dropped.
 */
function buildDetailPatch(
  type: string,
  input: UpdateAccountDetailsInput | CreateFinancialAccountInput
): Partial<DetailFields> {
  const allowed = new Set(DETAIL_FIELDS_BY_TYPE[type] ?? []);
  const patch: Partial<DetailFields> = {};

  function consume<K extends keyof DetailFields>(key: K, value: DetailFields[K] | undefined) {
    if (typeof value === "undefined") return;
    if (!allowed.has(key)) {
      throw new Error(`${String(key)} is not allowed on a ${type} account.`);
    }
    patch[key] = value;
  }

  // Pass values through verbatim so undefined (field not sent) short-circuits
  // the allowlist check. Coercing undefined → null here would make every
  // submit look like a "clear this field" intent, triggering false rejections
  // on fields the form never sent for this account type.
  consume("rateBps", input.rateBps);
  consume("originalPrincipalCents", input.originalPrincipalCents);
  consume("monthlyPaymentCents", input.monthlyPaymentCents);
  consume("loanTermMonths", input.loanTermMonths);
  consume(
    "loanStartedAt",
    typeof input.loanStartedAt === "undefined" ? undefined : parseLoanStart(input.loanStartedAt)
  );
  consume("creditLimitCents", input.creditLimitCents);
  consume("statementDay", input.statementDay);
  consume("paymentDueDay", input.paymentDueDay);
  consume(
    "institution",
    typeof input.institution === "undefined" ? undefined : input.institution?.trim() || null
  );

  return patch;
}

export async function createFinancialAccount(input: CreateFinancialAccountInput) {
  const session = await requireSession();
  const data = createFinancialAccountSchema.parse(input);
  const now = new Date();

  const detailPatch = buildDetailPatch(data.type, data);

  // trackHoldings is only meaningful on investment/crypto. Silently ignore
  // the flag on other types rather than erroring — the form may pass it
  // through speculatively when the user switches type back and forth.
  const trackHoldings =
    data.trackHoldings === true && (data.type === "investment" || data.type === "crypto");

  const created = await prisma.financialAccount.create({
    data: {
      userId: session.user.id,
      name: data.name,
      type: data.type,
      isLiability: data.isLiability,
      balanceCents: data.balanceCents,
      currency: data.currency,
      notes: data.notes?.trim() || null,
      trackHoldings,
      ...detailPatch,
      snapshots: {
        create: { balanceCents: data.balanceCents, takenAt: now }
      }
    }
  });

  revalidate();
  return { id: created.id };
}

export async function updateAccountDetails(
  id: string,
  input: UpdateAccountDetailsInput
) {
  const session = await requireSession();
  const data = updateAccountDetailsSchema.parse(input);
  const account = await prisma.financialAccount.findUnique({
    where: { id },
    select: { id: true, userId: true, type: true }
  });
  if (!account || account.userId !== session.user.id) {
    throw new Error("Account not found.");
  }

  const patch = buildDetailPatch(account.type, data);
  if (Object.keys(patch).length === 0) {
    revalidate();
    return;
  }

  await prisma.financialAccount.update({
    where: { id },
    data: patch
  });
  revalidate();
}

export async function updateFinancialAccount(
  id: string,
  input: UpdateFinancialAccountInput
) {
  const session = await requireSession();
  const data = updateFinancialAccountSchema.parse(input);
  await requireOwnedFinancialAccount(id, session.user.id);

  await prisma.financialAccount.update({
    where: { id },
    data: {
      ...(typeof data.name === "string" && { name: data.name }),
      ...(typeof data.type === "string" && { type: data.type }),
      ...(typeof data.isLiability === "boolean" && { isLiability: data.isLiability }),
      ...(typeof data.notes !== "undefined" && { notes: data.notes?.trim() || null })
    }
  });
  revalidate();
}

export async function updateAccountBalance(
  id: string,
  input: UpdateAccountBalanceInput
): Promise<{ previousCents: number; nextCents: number }> {
  const session = await requireSession();
  const data = updateAccountBalanceSchema.parse(input);
  const account = await requireOwnedFinancialAccount(id, session.user.id);
  const takenAt = parseTakenAt(data.takenAt);

  await prisma.$transaction([
    prisma.financialAccount.update({
      where: { id },
      data: { balanceCents: data.newBalanceCents }
    }),
    prisma.balanceSnapshot.create({
      data: {
        accountId: id,
        balanceCents: data.newBalanceCents,
        takenAt,
        note: data.note?.trim() || null
      }
    })
  ]);

  revalidate();
  return { previousCents: account.balanceCents, nextCents: data.newBalanceCents };
}

export async function archiveFinancialAccount(id: string) {
  const session = await requireSession();
  await requireOwnedFinancialAccount(id, session.user.id);
  await prisma.financialAccount.update({ where: { id }, data: { archived: true } });
  revalidate();
}

export async function unarchiveFinancialAccount(id: string) {
  const session = await requireSession();
  await requireOwnedFinancialAccount(id, session.user.id);
  await prisma.financialAccount.update({ where: { id }, data: { archived: false } });
  revalidate();
}

export async function setIncludeInNetWorth(id: string, included: boolean) {
  const session = await requireSession();
  await requireOwnedFinancialAccount(id, session.user.id);
  await prisma.financialAccount.update({
    where: { id },
    data: { includeInNetWorth: included }
  });
  revalidate();
}

export async function deleteSnapshot(id: string) {
  const session = await requireSession();
  await requireOwnedSnapshot(id, session.user.id);
  // Per the brief: deletion doesn't auto-rewind Account.balanceCents.
  await prisma.balanceSnapshot.delete({ where: { id } });
  revalidate();
}

export async function deleteFinancialAccount(id: string) {
  const session = await requireSession();
  await requireOwnedFinancialAccount(id, session.user.id);
  // Cascade in schema removes snapshots + holdings.
  await prisma.financialAccount.delete({ where: { id } });
  revalidate();
}

// ----- Holdings (investment + crypto accounts) -----

async function requireOwnedHolding(id: string, userId: string) {
  const holding = await prisma.holding.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      account: { select: { userId: true } }
    }
  });
  if (!holding || holding.account.userId !== userId) throw new Error("Holding not found.");
  return holding;
}

function parsePriceUpdate(input: string | undefined): Date {
  if (!input) return new Date();
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Recompute the account's balance from its holdings and append a snapshot.
 * Caller is expected to be inside (or about to commit) a transaction that
 * just mutated the holdings.
 */
async function recomputeAccountFromHoldings(accountId: string) {
  const holdings = await prisma.holding.findMany({
    where: { accountId },
    select: { shares: true, avgCostCents: true, lastKnownPriceCents: true }
  });

  const totalCents = accountValueFromHoldings(
    holdings.map((h) => ({
      shares: h.shares.toString(),
      avgCostCents: h.avgCostCents,
      lastKnownPriceCents: h.lastKnownPriceCents
    }))
  );

  await prisma.$transaction([
    prisma.financialAccount.update({
      where: { id: accountId },
      data: { balanceCents: totalCents }
    }),
    prisma.balanceSnapshot.create({
      data: { accountId, balanceCents: totalCents }
    })
  ]);
}

export async function setTrackHoldings(id: string, enabled: boolean) {
  const session = await requireSession();
  await requireOwnedFinancialAccount(id, session.user.id);

  await prisma.financialAccount.update({
    where: { id },
    data: { trackHoldings: enabled }
  });

  // When enabling, immediately derive the balance from any existing holdings.
  // When disabling, the current balanceCents stays as the frozen value the
  // user can edit manually thereafter.
  if (enabled) await recomputeAccountFromHoldings(id);

  revalidate();
}

export async function addHolding(accountId: string, input: HoldingInput) {
  const session = await requireSession();
  await requireOwnedFinancialAccount(accountId, session.user.id);
  const data = holdingInputSchema.parse(input);

  await prisma.holding.create({
    data: {
      accountId,
      ticker: data.ticker.trim().toUpperCase(),
      name: data.name?.trim() || null,
      shares: new Prisma.Decimal(data.shares),
      avgCostCents: data.avgCostCents ?? null,
      lastKnownPriceCents: data.lastKnownPriceCents,
      lastPriceUpdate: parsePriceUpdate(data.lastPriceUpdate),
      notes: data.notes?.trim() || null
    }
  });

  await recomputeAccountFromHoldings(accountId);
  revalidate();
}

export async function updateHolding(id: string, input: UpdateHoldingInput) {
  const session = await requireSession();
  const holding = await requireOwnedHolding(id, session.user.id);
  const data = updateHoldingSchema.parse(input);

  await prisma.holding.update({
    where: { id },
    data: {
      ...(typeof data.ticker === "string" && { ticker: data.ticker.trim().toUpperCase() }),
      ...(typeof data.name !== "undefined" && { name: data.name?.trim() || null }),
      ...(typeof data.shares === "string" && { shares: new Prisma.Decimal(data.shares) }),
      ...(typeof data.avgCostCents !== "undefined" && {
        avgCostCents: data.avgCostCents ?? null
      }),
      ...(typeof data.lastKnownPriceCents === "number" && {
        lastKnownPriceCents: data.lastKnownPriceCents
      }),
      ...(typeof data.lastPriceUpdate === "string" && {
        lastPriceUpdate: parsePriceUpdate(data.lastPriceUpdate)
      }),
      ...(typeof data.notes !== "undefined" && { notes: data.notes?.trim() || null })
    }
  });

  await recomputeAccountFromHoldings(holding.accountId);
  revalidate();
}

export async function updatePrice(id: string, input: UpdatePriceInput) {
  const session = await requireSession();
  const holding = await requireOwnedHolding(id, session.user.id);
  const data = updatePriceSchema.parse(input);

  await prisma.holding.update({
    where: { id },
    data: {
      lastKnownPriceCents: data.lastKnownPriceCents,
      lastPriceUpdate: parsePriceUpdate(data.lastPriceUpdate)
    }
  });

  await recomputeAccountFromHoldings(holding.accountId);
  revalidate();
}

export async function deleteHolding(id: string) {
  const session = await requireSession();
  const holding = await requireOwnedHolding(id, session.user.id);
  await prisma.holding.delete({ where: { id } });
  await recomputeAccountFromHoldings(holding.accountId);
  revalidate();
}
