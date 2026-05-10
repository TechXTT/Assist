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
import { parseCentsInput } from "@/lib/money/format";
import { addHolding, updateHolding } from "@/app/(app)/money/actions";

const formSchema = z.object({
  ticker: z.string().trim().min(1, "Ticker?"),
  name: z.string().max(80).optional(),
  shares: z
    .string()
    .min(1, "How many shares?")
    .refine((v) => {
      const n = Number.parseFloat(v.replace(",", "."));
      return Number.isFinite(n) && n > 0;
    }, "Enter a positive number."),
  avgCost: z.string().optional(),
  price: z
    .string()
    .min(1, "Latest price?")
    .refine((v) => {
      const c = parseCentsInput(v);
      return c !== null && c >= 0;
    }, "That doesn't look like a number."),
  lastPriceUpdate: z.string().optional()
});

export type HoldingFormValues = z.infer<typeof formSchema>;

type Props =
  | {
      mode: "create";
      accountType: "investment" | "crypto";
      accountId: string;
      onDone: () => void;
      defaultValues?: never;
      holdingId?: never;
    }
  | {
      mode: "edit";
      accountType: "investment" | "crypto";
      onDone: () => void;
      defaultValues: HoldingFormValues;
      holdingId: string;
      accountId?: never;
    };

export function HoldingForm(props: Props) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<HoldingFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues:
      props.mode === "edit"
        ? props.defaultValues
        : {
            ticker: "",
            name: "",
            shares: "",
            avgCost: "",
            price: "",
            lastPriceUpdate: ""
          }
  });

  async function onSubmit(values: HoldingFormValues) {
    const priceCents = parseCentsInput(values.price);
    if (priceCents === null || priceCents < 0) {
      form.setError("price", { message: "That doesn't look like a number." });
      return;
    }
    const avgCostCents =
      values.avgCost && values.avgCost.trim() ? parseCentsInput(values.avgCost) : null;

    setSubmitting(true);
    try {
      const payload = {
        ticker: values.ticker.trim().toUpperCase(),
        name: values.name?.trim() || null,
        shares: values.shares.replace(",", "."),
        avgCostCents: avgCostCents === null ? null : avgCostCents,
        lastKnownPriceCents: priceCents,
        lastPriceUpdate: values.lastPriceUpdate?.trim() || undefined
      };
      if (props.mode === "create") {
        await addHolding(props.accountId, payload);
        toast.success("Holding added.");
      } else {
        await updateHolding(props.holdingId, payload);
        toast.success("Saved.");
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
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="ticker"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ticker</FormLabel>
                <FormControl>
                  <Input
                    placeholder={props.accountType === "crypto" ? "BTC" : "VWCE"}
                    autoFocus={props.mode === "create"}
                    {...field}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Vanguard FTSE All-World" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="shares"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Shares</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="0.4823" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="avgCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avg cost / share (optional)</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="100.00" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Latest price / share</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="104.20" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="lastPriceUpdate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price as of (optional)</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
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
            {submitting ? "Saving…" : props.mode === "create" ? "Add holding" : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
