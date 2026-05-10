"use client";

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { parseCentsInput } from "@/lib/money/format";
import { createBill, updateBill } from "@/app/(app)/money/actions";
import type { CategoryRow } from "@/lib/money/category-queries";

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name."),
    amount: z
      .string()
      .min(1, "How much?")
      .refine((v) => {
        const c = parseCentsInput(v);
        return c !== null && c > 0;
      }, "That doesn't look like a number."),
    category: z.string().optional(),
    recurring: z.boolean(),
    dueDay: z.string().optional(), // 1-31 as string from input
    dueDate: z.string().optional(), // YYYY-MM-DD
    reminderEnabled: z.boolean(),
    notes: z.string().max(500).optional()
  })
  .refine(
    (v) =>
      v.recurring
        ? Boolean(v.dueDay && /^\d+$/.test(v.dueDay) && Number(v.dueDay) >= 1 && Number(v.dueDay) <= 31)
        : Boolean(v.dueDate),
    { message: "Pick a due day or due date.", path: ["recurring"] }
  );

export type BillFormValues = z.infer<typeof formSchema>;

type Props =
  | {
      mode: "create";
      categories: CategoryRow[];
      currency: string;
      onDone: () => void;
      defaultValues?: never;
      billId?: never;
    }
  | {
      mode: "edit";
      categories: CategoryRow[];
      currency: string;
      onDone: () => void;
      defaultValues: BillFormValues;
      billId: string;
    };

export function BillForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<BillFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            name: "",
            amount: "",
            category: "",
            recurring: true,
            dueDay: "1",
            dueDate: "",
            reminderEnabled: true,
            notes: ""
          }
  });

  const recurring = form.watch("recurring");
  const selectedCategory = form.watch("category") ?? "";

  // Clear the now-irrelevant date field when toggling recurring.
  useEffect(() => {
    if (recurring) form.setValue("dueDate", "");
    else form.setValue("dueDay", "");
  }, [recurring, form]);

  async function onSubmit(values: BillFormValues) {
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
        category: values.category?.trim() || null,
        recurring: values.recurring,
        dueDay: values.recurring && values.dueDay ? Number(values.dueDay) : null,
        dueDate: !values.recurring && values.dueDate ? values.dueDate : null,
        reminderEnabled: values.reminderEnabled,
        notes: values.notes?.trim() || null
      };
      if (props.mode === "create") {
        await createBill(payload);
        toast.success("Bill added.");
      } else {
        await updateBill(props.billId, payload);
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
                <Input placeholder="Phone, Rent, Gym…" autoFocus={props.mode === "create"} {...field} />
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
                <Input inputMode="decimal" placeholder="45" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="recurring"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency</FormLabel>
              <FormControl>
                <div className="inline-flex rounded-md border bg-background p-0.5">
                  <button
                    type="button"
                    onClick={() => field.onChange(true)}
                    className={cn(
                      "rounded px-3 py-1 text-sm font-medium transition-colors",
                      field.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => field.onChange(false)}
                    className={cn(
                      "rounded px-3 py-1 text-sm font-medium transition-colors",
                      !field.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    One-off
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {recurring ? (
          <FormField
            control={form.control}
            name="dueDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Day of the month</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={31} placeholder="15" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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

        <FormField
          control={form.control}
          name="reminderEnabled"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label className="text-sm">Remind me 3 days before</Label>
                  <p className="text-xs text-muted-foreground">Surfaces in the dashboard banner.</p>
                </div>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Account number hint, payment URL…"
                  {...field}
                />
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
            {submitting ? "Saving…" : props.mode === "create" ? "Add bill" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
