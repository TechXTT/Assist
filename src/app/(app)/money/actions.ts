"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40),
  color: z.string().regex(HEX_COLOR, "Pick a color.").default("#7c9885"),
  monthlyLimitCents: z.number().int().nonnegative().default(0)
});

const renameCategorySchema = z.object({
  name: z.string().trim().min(1, "Give it a name.").max(40)
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
