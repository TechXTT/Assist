"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseCentsInput } from "@/lib/money/format";
import {
  createTransaction,
  suggestCategoryAction,
  updateTransaction
} from "@/app/(app)/money/actions";
import type { CategoryRow } from "@/lib/money/category-queries";
import { NewCategoryInline } from "@/app/(app)/money/_components/spending/new-category-inline";

const formSchema = z.object({
  amount: z
    .string()
    .min(1, "How much?")
    .refine((v) => parseCentsInput(v) !== null, "That doesn't look like a number."),
  sign: z.enum(["expense", "income"]),
  category: z.string().optional(),
  description: z.string().max(200).optional(),
  occurredAt: z.string().min(1, "Pick a date.")
});

export type TransactionFormValues = z.infer<typeof formSchema>;

type Props =
  | { mode: "create"; categories: CategoryRow[]; currency: string; onDone: () => void; defaultValues?: never; transactionId?: never }
  | {
      mode: "edit";
      categories: CategoryRow[];
      currency: string;
      onDone: () => void;
      defaultValues: TransactionFormValues;
      transactionId: string;
    };

export function TransactionForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            amount: "",
            sign: "expense",
            category: "",
            description: "",
            occurredAt: localNowInput()
          }
  });

  const sign = form.watch("sign");
  const selectedCategory = form.watch("category") ?? "";
  const watchedDescription = form.watch("description") ?? "";
  const watchedAmount = form.watch("amount") ?? "";

  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [rejectedSuggestions] = useState(() => new Set<string>());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (selectedCategory) {
      setSuggestion(null);
      return;
    }
    const desc = watchedDescription.trim();
    if (desc.length < 3) {
      setSuggestion(null);
      return;
    }
    const cents = parseCentsInput(watchedAmount);
    if (cents === null) {
      setSuggestion(null);
      return;
    }
    const signed = sign === "expense" ? -Math.abs(cents) : Math.abs(cents);
    const cacheKey = `${desc.toLowerCase()}::${signed}`;
    if (rejectedSuggestions.has(cacheKey)) return;

    debounceRef.current = setTimeout(async () => {
      setSuggesting(true);
      try {
        const result = await suggestCategoryAction({
          description: desc,
          amountCents: signed,
          sign
        });
        if (result && !rejectedSuggestions.has(cacheKey)) {
          setSuggestion(result.category);
        } else {
          setSuggestion(null);
        }
      } catch {
        setSuggestion(null);
      } finally {
        setSuggesting(false);
      }
    }, 700);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watchedDescription, watchedAmount, sign, selectedCategory, rejectedSuggestions]);

  async function onSubmit(values: TransactionFormValues) {
    const cents = parseCentsInput(values.amount);
    if (cents === null) {
      form.setError("amount", { message: "That doesn't look like a number." });
      return;
    }
    const signed = values.sign === "expense" ? -Math.abs(cents) : Math.abs(cents);

    setSubmitting(true);
    try {
      const payload = {
        amountCents: signed,
        currency: props.currency,
        description: values.description?.trim() || null,
        category: values.category?.trim() || null,
        occurredAt: values.occurredAt
      };
      if (props.mode === "create") {
        await createTransaction(payload);
        toast.success("Logged.");
      } else {
        await updateTransaction(props.transactionId, payload);
        toast.success("Updated.");
      }
      props.onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="sign"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  {(["expense", "income"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => field.onChange(s)}
                      className={cn(
                        "rounded px-3 py-1 text-sm font-medium transition-colors",
                        field.value === s
                          ? s === "expense"
                            ? "bg-foreground text-background"
                            : "bg-emerald-600 text-white"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {s === "expense" ? "Expense" : "Income"}
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder={sign === "expense" ? "12.34" : "1000"}
                  autoFocus={props.mode === "create"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              {creatingCategory ? (
                <NewCategoryInline
                  onCreated={(name) => {
                    field.onChange(name);
                    setCreatingCategory(false);
                  }}
                  onCancel={() => setCreatingCategory(false)}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {props.categories.map((c) => {
                    const active = selectedCategory === c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => field.onChange(active ? "" : c.name)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: c.color }}
                        />
                        {c.name}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setCreatingCategory(true)}
                    className="inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                  >
                    + New
                  </button>
                </div>
              )}
              {!selectedCategory && !creatingCategory && (suggestion || suggesting) && (
                <div className="flex items-center gap-2 pt-1">
                  <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden />
                  {suggesting && !suggestion ? (
                    <span className="text-xs text-muted-foreground">Thinking…</span>
                  ) : suggestion ? (
                    <>
                      <span className="text-xs text-muted-foreground">Try</span>
                      <button
                        type="button"
                        onClick={() => {
                          field.onChange(suggestion);
                          setSuggestion(null);
                        }}
                        className="inline-flex items-center rounded-full border border-foreground/30 bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted"
                      >
                        {suggestion}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const desc = watchedDescription.trim().toLowerCase();
                          const cents = parseCentsInput(watchedAmount);
                          const signed = sign === "expense" ? -Math.abs(cents ?? 0) : Math.abs(cents ?? 0);
                          rejectedSuggestions.add(`${desc}::${signed}`);
                          setSuggestion(null);
                        }}
                        aria-label="Dismiss suggestion"
                        className="text-xs text-muted-foreground hover:underline"
                      >
                        no
                      </button>
                    </>
                  ) : null}
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Coffee with E., shared rent, etc." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="occurredAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>When</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={props.onDone} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : props.mode === "create" ? "Log it" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function localNowInput(): string {
  // datetime-local wants "yyyy-MM-ddTHH:mm" in local time.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
