"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";
import { deriveHoursFromTimes } from "@/lib/health/sleep";
import { logSleep } from "@/app/(app)/health/actions";

const HOUR_RE = /^\d{1,2}([.,]\d{1,2})?$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const formSchema = z
  .object({
    mode: z.enum(["hours", "times"]),
    date: z.string().min(1, "Pick a date."),
    hours: z.string().optional(),
    bedtime: z.string().optional(),
    wakeTime: z.string().optional()
  })
  .superRefine((v, ctx) => {
    if (v.mode === "hours") {
      if (!v.hours || !HOUR_RE.test(v.hours.replace(",", "."))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["hours"],
          message: "How many hours?"
        });
      } else {
        const n = Number(v.hours.replace(",", "."));
        if (!(n > 0 && n <= 24)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["hours"],
            message: "Between 0 and 24."
          });
        }
      }
    } else {
      if (!v.bedtime || !TIME_RE.test(v.bedtime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bedtime"],
          message: "Use HH:mm."
        });
      }
      if (!v.wakeTime || !TIME_RE.test(v.wakeTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wakeTime"],
          message: "Use HH:mm."
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

export function LogSleepDialog({
  open,
  onOpenChange,
  defaultDateIso
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDateIso: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      mode: "hours",
      date: defaultDateIso,
      hours: "",
      bedtime: "",
      wakeTime: ""
    }
  });

  const mode = form.watch("mode");
  const bedtime = form.watch("bedtime");
  const wake = form.watch("wakeTime");
  const livePreview =
    mode === "times" && bedtime && wake && TIME_RE.test(bedtime) && TIME_RE.test(wake)
      ? deriveHoursFromTimes(bedtime, wake)
      : null;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      if (values.mode === "hours") {
        await logSleep({
          mode: "hours",
          date: values.date,
          hours: Number(values.hours!.replace(",", "."))
        });
      } else {
        await logSleep({
          mode: "times",
          date: values.date,
          bedtime: values.bedtime!,
          wakeTime: values.wakeTime!
        });
      }
      toast.success("Sleep logged.");
      onOpenChange(false);
      form.reset({
        mode: "hours",
        date: defaultDateIso,
        hours: "",
        bedtime: "",
        wakeTime: ""
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log sleep</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How are you logging it?</FormLabel>
                  <FormControl>
                    <div className="inline-flex gap-1 rounded-md border bg-background p-0.5">
                      {[
                        { value: "hours", label: "Hours" },
                        { value: "times", label: "Bedtime + wake" }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={cn(
                            "rounded px-3 py-1 text-sm font-medium transition-colors",
                            field.value === opt.value
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </FormControl>
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

            {mode === "hours" ? (
              <FormField
                control={form.control}
                name="hours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" placeholder="7.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="bedtime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedtime</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wakeTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wake time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {livePreview !== null && (
              <p className="text-xs text-muted-foreground">
                That's {livePreview.toFixed(2)}h of sleep.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
