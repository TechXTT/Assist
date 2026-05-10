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
import { parseCentsInput } from "@/lib/money/format";
import {
  createIncomeSource,
  updateIncomeSource
} from "@/app/(app)/money/actions";
import { CADENCES, type Cadence } from "@/lib/money/income";

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
    cadence: z.enum(["monthly", "biweekly", "weekly", "oneoff"]),
    cadenceAnchorDay: z.string().optional(),
    nextExpectedAt: z.string().min(1, "Pick a date."),
    category: z.string().trim().max(40).optional(),
    notes: z.string().max(500).optional()
  })
  .refine(
    (v) => {
      if (v.cadence !== "monthly") return true;
      const day = Number(v.cadenceAnchorDay);
      return Number.isFinite(day) && day >= 1 && day <= 31;
    },
    { message: "Pick a day of the month (1-31).", path: ["cadenceAnchorDay"] }
  );

export type IncomeSourceFormValues = z.infer<typeof formSchema>;

type Props =
  | {
      mode: "create";
      currency: string;
      onDone: () => void;
      defaultValues?: never;
      sourceId?: never;
    }
  | {
      mode: "edit";
      currency: string;
      onDone: () => void;
      defaultValues: IncomeSourceFormValues;
      sourceId: string;
    };

const CADENCE_LABELS: Record<Cadence, string> = {
  monthly: "Monthly",
  biweekly: "Biweekly",
  weekly: "Weekly",
  oneoff: "One-off"
};

export function IncomeSourceForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<IncomeSourceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            name: "",
            amount: "",
            cadence: "monthly",
            cadenceAnchorDay: "1",
            nextExpectedAt: "",
            category: "Income",
            notes: ""
          }
  });

  const cadence = form.watch("cadence");

  // Clear the now-irrelevant anchor day when toggling cadence away from monthly.
  useEffect(() => {
    if (cadence !== "monthly") form.setValue("cadenceAnchorDay", "");
    else if (!form.getValues("cadenceAnchorDay")) form.setValue("cadenceAnchorDay", "1");
  }, [cadence, form]);

  async function onSubmit(values: IncomeSourceFormValues) {
    const cents = parseCentsInput(values.amount);
    if (cents === null || cents <= 0) {
      form.setError("amount", { message: "That doesn't look like a number." });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        expectedAmountCents: cents,
        currency: props.currency,
        cadence: values.cadence,
        cadenceAnchorDay:
          values.cadence === "monthly" && values.cadenceAnchorDay
            ? Number(values.cadenceAnchorDay)
            : null,
        nextExpectedAt: values.nextExpectedAt,
        category: values.category?.trim() || "Income",
        notes: values.notes?.trim() || null
      };
      if (props.mode === "create") {
        await createIncomeSource(payload);
        toast.success("Income source added.");
      } else {
        await updateIncomeSource(props.sourceId, payload);
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
                <Input
                  placeholder="Part-time job, allowance, scholarship…"
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
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Expected amount</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="350" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cadence"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cadence</FormLabel>
              <FormControl>
                <div className="inline-flex flex-wrap gap-1 rounded-md border bg-background p-0.5">
                  {CADENCES.map((c) => (
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
                      {CADENCE_LABELS[c]}
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {cadence === "monthly" && (
          <FormField
            control={form.control}
            name="cadenceAnchorDay"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Day of the month</FormLabel>
                <FormControl>
                  <Input type="number" min={1} max={31} placeholder="15" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  If a month is shorter, the last valid day is used (e.g. 31 → 28 in Feb).
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="nextExpectedAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Next expected</FormLabel>
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
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Input placeholder="Income" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Tag for the resulting transaction. Defaults to "Income".
              </p>
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
                <Textarea rows={2} placeholder="Anything to remember about this source?" {...field} />
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
            {submitting ? "Saving…" : props.mode === "create" ? "Add source" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
