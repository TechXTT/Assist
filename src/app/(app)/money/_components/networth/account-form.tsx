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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { parseCentsInput } from "@/lib/money/format";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_META,
  type AccountType
} from "@/lib/money/account-type-meta";
import {
  createFinancialAccount,
  updateFinancialAccount
} from "@/app/(app)/money/actions";

const formSchema = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  type: z.enum(["cash", "savings", "investment", "crypto", "credit", "loan", "other"]),
  isLiability: z.boolean(),
  startingBalance: z
    .string()
    .optional()
    .refine(
      (v) => {
        if (!v || !v.trim()) return true;
        const c = parseCentsInput(v);
        return c !== null && c >= 0;
      },
      "That doesn't look like a number."
    ),
  notes: z.string().max(500).optional()
});

export type AccountFormValues = z.infer<typeof formSchema>;

type Props =
  | {
      mode: "create";
      currency: string;
      onDone: () => void;
      defaultValues?: never;
      accountId?: never;
    }
  | {
      mode: "edit";
      currency: string;
      onDone: () => void;
      defaultValues: AccountFormValues;
      accountId: string;
    };

export function AccountForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [touchedLiability, setTouchedLiability] = useState(false);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            name: "",
            type: "cash",
            isLiability: ACCOUNT_TYPE_META.cash.defaultLiability,
            startingBalance: "",
            notes: ""
          }
  });

  const watchedType = form.watch("type");

  // When type changes (and the user hasn't manually set isLiability), apply
  // the type's default liability flag.
  useEffect(() => {
    if (touchedLiability) return;
    form.setValue("isLiability", ACCOUNT_TYPE_META[watchedType].defaultLiability);
  }, [watchedType, touchedLiability, form]);

  async function onSubmit(values: AccountFormValues) {
    const cents =
      values.startingBalance && values.startingBalance.trim()
        ? parseCentsInput(values.startingBalance) ?? 0
        : 0;

    setSubmitting(true);
    try {
      if (props.mode === "create") {
        await createFinancialAccount({
          name: values.name.trim(),
          type: values.type,
          isLiability: values.isLiability,
          balanceCents: cents,
          currency: props.currency,
          notes: values.notes?.trim() || null
        });
        toast.success("Account added.");
      } else {
        await updateFinancialAccount(props.accountId, {
          name: values.name.trim(),
          type: values.type,
          isLiability: values.isLiability,
          notes: values.notes?.trim() || null
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
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Revolut, N26 savings, Trade Republic…"
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
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {ACCOUNT_TYPES.map((t) => {
                    const meta = ACCOUNT_TYPE_META[t];
                    const Icon = meta.icon;
                    const active = field.value === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => field.onChange(t)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs transition-colors",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {meta.label}
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
          name="isLiability"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div>
                  <Label className="text-sm">Liability</Label>
                  <p className="text-xs text-muted-foreground">
                    Counts against your net worth (debt, balance owed).
                  </p>
                </div>
                <Switch
                  checked={field.value}
                  onCheckedChange={(v) => {
                    setTouchedLiability(true);
                    field.onChange(v);
                  }}
                />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {props.mode === "create" && (
          <FormField
            control={form.control}
            name="startingBalance"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Starting balance</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="0" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Always a positive number — the liability toggle handles the sign.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Anything to remember about this account?"
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
            {submitting ? "Saving…" : props.mode === "create" ? "Add account" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export type { AccountType };
