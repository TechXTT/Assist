"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

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
import { createGoal, updateGoal } from "@/app/(app)/money/actions";

const formSchema = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  target: z
    .string()
    .min(1, "Set a target.")
    .refine((v) => {
      const c = parseCentsInput(v);
      return c !== null && c > 0;
    }, "That doesn't look like a number."),
  targetDate: z.string().optional(),
  notes: z.string().max(500).optional()
});

export type GoalFormValues = z.infer<typeof formSchema>;

type Props =
  | { mode: "create"; onDone: () => void; defaultValues?: never; goalId?: never }
  | { mode: "edit"; onDone: () => void; defaultValues: GoalFormValues; goalId: string };

export function GoalForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : { name: "", target: "", targetDate: "", notes: "" }
  });

  async function onSubmit(values: GoalFormValues) {
    const cents = parseCentsInput(values.target);
    if (cents === null || cents <= 0) {
      form.setError("target", { message: "That doesn't look like a number." });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: values.name.trim(),
        targetCents: cents,
        targetDate: values.targetDate?.trim() || null,
        notes: values.notes?.trim() || null
      };
      if (props.mode === "create") {
        await createGoal(payload);
        toast.success("Goal set.");
      } else {
        await updateGoal(props.goalId, payload);
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
                <Input placeholder="Trip, laptop, emergency…" autoFocus={props.mode === "create"} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="target"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target amount</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="1200" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="targetDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Target date (optional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
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
                <Textarea rows={2} placeholder="What's it for?" {...field} />
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
            {submitting ? "Saving…" : props.mode === "create" ? "Set goal" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
