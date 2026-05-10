"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
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
import { parseCentsInput } from "@/lib/money/format";
import {
  createSubscription,
  updateSubscription
} from "@/app/(app)/money/actions";
import type { CategoryRow } from "@/lib/money/category-queries";

const formSchema = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  amount: z
    .string()
    .min(1, "How much?")
    .refine((v) => {
      const c = parseCentsInput(v);
      return c !== null && c > 0;
    }, "That doesn't look like a number."),
  billingCycle: z.enum(["monthly", "annual"]),
  nextChargeAt: z.string().min(1, "Pick a date."),
  category: z.string().optional()
});

export type SubFormValues = z.infer<typeof formSchema>;

type Props =
  | {
      mode: "create";
      categories: CategoryRow[];
      currency: string;
      onDone: () => void;
      defaultValues?: never;
      subId?: never;
    }
  | {
      mode: "edit";
      categories: CategoryRow[];
      currency: string;
      onDone: () => void;
      defaultValues: SubFormValues;
      subId: string;
    };

export function SubForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SubFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            name: "",
            amount: "",
            billingCycle: "monthly",
            nextChargeAt: "",
            category: ""
          }
  });

  const cycle = form.watch("billingCycle");
  const selectedCategory = form.watch("category") ?? "";

  async function onSubmit(values: SubFormValues) {
    const cents = parseCentsInput(values.amount);
    if (cents === null || cents <= 0) {
      form.setError("amount", { message: "That doesn't look like a number." });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        amountCents: cents,
        currency: props.currency,
        billingCycle: values.billingCycle,
        nextChargeAt: values.nextChargeAt,
        category: values.category?.trim() || null
      };
      if (props.mode === "create") {
        await createSubscription(payload);
        toast.success("Got it.");
      } else {
        await updateSubscription(props.subId, payload);
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
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Spotify, Netflix, gym…" autoFocus={props.mode === "create"} {...field} />
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
                <Input inputMode="decimal" placeholder="9.99" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="billingCycle"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Billing cycle</FormLabel>
              <FormControl>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  {(["monthly", "annual"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => field.onChange(c)}
                      className={cn(
                        "rounded px-3 py-1 text-sm font-medium transition-colors",
                        field.value === c
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {c === "monthly" ? "Monthly" : "Annual"}
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
          name="nextChargeAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Next charge</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
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
              <FormLabel>Category (optional)</FormLabel>
              <FormControl>
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
                </div>
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
            {submitting ? "Saving…" : props.mode === "create" ? "Add subscription" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
