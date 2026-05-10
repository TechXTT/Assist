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
import { createBudget, updateBudget } from "@/app/(app)/money/actions";
import { CATEGORY_COLORS } from "@/app/(app)/money/_components/spending/new-category-inline";

const formSchema = z.object({
  name: z.string().trim().min(1, "Pick a category."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a color."),
  limit: z
    .string()
    .min(1, "Set a monthly limit.")
    .refine((v) => {
      const cents = parseCentsInput(v);
      return cents !== null && cents > 0;
    }, "Set a limit above zero.")
});

export type BudgetFormValues = z.infer<typeof formSchema>;

export type CandidateCategory = { id: string; name: string; color: string };

type Props =
  | {
      mode: "create";
      currency: string;
      onDone: () => void;
      candidates: CandidateCategory[]; // existing categories without a budget
      defaultValues?: never;
      budgetId?: never;
    }
  | {
      mode: "edit";
      currency: string;
      onDone: () => void;
      defaultValues: BudgetFormValues;
      budgetId: string;
      candidates?: never;
    };

export function BudgetForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [pickingNew, setPickingNew] = useState(false);

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : { name: "", color: CATEGORY_COLORS[0], limit: "" }
  });

  const selectedName = form.watch("name");
  const selectedColor = form.watch("color");

  function pickCandidate(c: CandidateCategory) {
    form.setValue("name", c.name);
    form.setValue("color", c.color, { shouldDirty: true });
    setPickingNew(false);
  }

  async function onSubmit(values: BudgetFormValues) {
    const cents = parseCentsInput(values.limit);
    if (cents === null || cents <= 0) {
      form.setError("limit", { message: "Set a limit above zero." });
      return;
    }

    setSubmitting(true);
    try {
      if (props.mode === "create") {
        await createBudget({
          name: values.name.trim(),
          color: values.color,
          monthlyLimitCents: cents
        });
        toast.success("Budget set.");
      } else {
        await updateBudget(props.budgetId, {
          color: values.color,
          monthlyLimitCents: cents
        });
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
        {props.mode === "create" && (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    {!pickingNew && props.candidates.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {props.candidates.map((c) => {
                          const active = selectedName === c.name;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => pickCandidate(c)}
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
                    )}
                    {pickingNew ? (
                      <Input
                        placeholder="New category name"
                        autoFocus
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setPickingNew(false);
                            field.onChange("");
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPickingNew(true);
                          field.onChange("");
                        }}
                        className="inline-flex items-center rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        + New category
                      </button>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <FormControl>
                <div className="flex flex-wrap items-center gap-1.5">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => field.onChange(c)}
                      className={cn(
                        "h-6 w-6 rounded-full transition-all",
                        selectedColor === c && "ring-2 ring-foreground ring-offset-2"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="limit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly limit</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="50" {...field} />
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
            {submitting ? "Saving…" : props.mode === "create" ? "Set budget" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
