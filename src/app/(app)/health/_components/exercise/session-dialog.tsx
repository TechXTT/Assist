"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { toZonedTime } from "date-fns-tz";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
import { createSession, updateSession } from "@/app/(app)/health/actions";
import type { ExerciseSessionRow } from "@/lib/health/exercise-queries";

const schema = z.object({
  activity: z.string().trim().min(1, "What did you do?").max(60),
  minutes: z
    .string()
    .min(1, "How many minutes?")
    .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, "Above zero."),
  date: z.string().min(1, "Pick a date."),
  notes: z.string().max(500).optional()
});

type FormValues = z.infer<typeof schema>;

type Props =
  | {
      mode: "create";
      timezone: string;
      defaultDateIso: string;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      session?: never;
    }
  | {
      mode: "edit";
      timezone: string;
      session: ExerciseSessionRow;
      open: boolean;
      onOpenChange: (open: boolean) => void;
      defaultDateIso?: never;
    };

function defaultDateIsoForSession(s: ExerciseSessionRow, tz: string): string {
  const local = toZonedTime(s.occurredAt, tz);
  return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

export function SessionDialog(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues:
      props.mode === "edit"
        ? {
            activity: props.session.activity,
            minutes: String(props.session.minutes),
            date: defaultDateIsoForSession(props.session, props.timezone),
            notes: props.session.notes ?? ""
          }
        : {
            activity: "",
            minutes: "",
            date: props.defaultDateIso,
            notes: ""
          }
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload = {
        activity: values.activity.trim(),
        minutes: Math.floor(Number(values.minutes)),
        occurredAt: values.date,
        notes: values.notes?.trim() || null
      };
      if (props.mode === "create") {
        await createSession(payload);
        toast.success("Session logged.");
      } else {
        await updateSession(props.session.id, payload);
        toast.success("Updated.");
      }
      props.onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {props.mode === "create" ? "Log a session" : "Edit session"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="activity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Activity</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Running, Gym, Yoga, Football…"
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
              name="minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Minutes</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="30" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
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
                    <Textarea rows={2} placeholder="Anything worth remembering?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => props.onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : props.mode === "create" ? "Log session" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
