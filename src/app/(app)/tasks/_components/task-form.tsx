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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { createTask, updateTask } from "@/app/(app)/tasks/actions";

const formSchema = z.object({
  title: z.string().trim().min(1, "Give it a title."),
  description: z.string().trim().max(2000).optional(),
  dueAt: z.string().optional(),
  priority: z.enum(["low", "med", "high"])
});

export type TaskFormValues = z.infer<typeof formSchema>;

type Props =
  | {
      mode: "create";
      onDone: () => void;
      defaultValues?: never;
      taskId?: never;
    }
  | {
      mode: "edit";
      onDone: () => void;
      defaultValues: TaskFormValues;
      taskId: string;
    };

const SUCCESS_BLURBS = [
  "Added — see you on this one.",
  "Got it. On the list.",
  "Logged. No pressure.",
  "Saved."
];

function pickBlurb() {
  return SUCCESS_BLURBS[Math.floor(Math.random() * SUCCESS_BLURBS.length)];
}

export function TaskForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : { title: "", description: "", dueAt: "", priority: "med" }
  });

  async function onSubmit(values: TaskFormValues) {
    setSubmitting(true);
    try {
      const payload = {
        title: values.title,
        description: values.description?.trim() || null,
        dueAt: values.dueAt?.trim() || null,
        priority: values.priority
      };
      if (props.mode === "create") {
        await createTask(payload);
        toast.success(pickBlurb());
      } else {
        await updateTask(props.taskId, payload);
        toast.success("Updated.");
      }
      props.onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went sideways.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="What is it?" autoFocus {...field} />
              </FormControl>
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
                <Textarea
                  rows={3}
                  placeholder="Anything you want to remember about it?"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="dueAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Due (optional)</FormLabel>
              <FormControl>
                <Input type="datetime-local" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="priority"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex gap-4"
                >
                  {(["low", "med", "high"] as const).map((p) => (
                    <div key={p} className="flex items-center gap-2">
                      <RadioGroupItem value={p} id={`priority-${p}`} />
                      <Label htmlFor={`priority-${p}`} className="cursor-pointer capitalize">
                        {p}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
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
            {submitting ? "Saving…" : props.mode === "create" ? "Add task" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
