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
  updateAccountDetails,
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
  notes: z.string().max(500).optional(),

  // Detail fields — all optional strings, parsed on submit.
  rate: z.string().optional(), // percentage, e.g. "4.5"
  institution: z.string().max(80).optional(),
  trackHoldings: z.boolean().optional(),
  creditLimit: z.string().optional(),
  statementDay: z.string().optional(),
  paymentDueDay: z.string().optional(),
  originalPrincipal: z.string().optional(),
  monthlyPayment: z.string().optional(),
  loanTermMonths: z.string().optional(),
  loanStartedAt: z.string().optional()
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

function bpsFromPercent(input: string | undefined): number | null {
  if (!input || !input.trim()) return null;
  const n = Number.parseFloat(input.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100); // 4.5% → 450 bps
}

function intFromString(input: string | undefined): number | null {
  if (!input || !input.trim()) return null;
  const n = Number.parseInt(input, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function centsFromInput(input: string | undefined): number | null {
  if (!input || !input.trim()) return null;
  const c = parseCentsInput(input);
  return c !== null && c >= 0 ? c : null;
}

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
            notes: "",
            rate: "",
            institution: "",
            trackHoldings: false,
            creditLimit: "",
            statementDay: "",
            paymentDueDay: "",
            originalPrincipal: "",
            monthlyPayment: "",
            loanTermMonths: "",
            loanStartedAt: ""
          }
  });

  const watchedType = form.watch("type");

  useEffect(() => {
    if (touchedLiability) return;
    form.setValue("isLiability", ACCOUNT_TYPE_META[watchedType].defaultLiability);
  }, [watchedType, touchedLiability, form]);

  async function onSubmit(values: AccountFormValues) {
    const cents =
      values.startingBalance && values.startingBalance.trim()
        ? parseCentsInput(values.startingBalance) ?? 0
        : 0;

    // Type-aware detail payload — fields outside the type's allowlist are
    // dropped here; the server validates again.
    const details = buildDetailsPayload(values);

    setSubmitting(true);
    try {
      if (props.mode === "create") {
        await createFinancialAccount({
          name: values.name.trim(),
          type: values.type,
          isLiability: values.isLiability,
          balanceCents: cents,
          currency: props.currency,
          notes: values.notes?.trim() || null,
          trackHoldings:
            (values.type === "investment" || values.type === "crypto") &&
            values.trackHoldings === true,
          ...details
        });
        toast.success("Account added.");
      } else {
        await updateFinancialAccount(props.accountId, {
          name: values.name.trim(),
          type: values.type,
          isLiability: values.isLiability,
          notes: values.notes?.trim() || null
        });
        // Two-step per the brief: base fields, then type-specific details.
        if (Object.keys(details).length > 0) {
          await updateAccountDetails(props.accountId, details);
        }
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

        <DetailsSection type={watchedType} form={form} mode={props.mode} />

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

function buildDetailsPayload(values: AccountFormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  switch (values.type) {
    case "cash":
    case "other":
      out.institution = values.institution?.trim() || null;
      break;
    case "savings":
      out.rateBps = bpsFromPercent(values.rate);
      out.institution = values.institution?.trim() || null;
      break;
    case "investment":
    case "crypto":
      out.institution = values.institution?.trim() || null;
      break;
    case "credit":
      out.rateBps = bpsFromPercent(values.rate);
      out.creditLimitCents = centsFromInput(values.creditLimit);
      out.statementDay = intFromString(values.statementDay);
      out.paymentDueDay = intFromString(values.paymentDueDay);
      // 4K: credit feeds the cash-flow forecast via monthly payment too.
      out.monthlyPaymentCents = centsFromInput(values.monthlyPayment);
      out.institution = values.institution?.trim() || null;
      break;
    case "loan":
      out.rateBps = bpsFromPercent(values.rate);
      out.originalPrincipalCents = centsFromInput(values.originalPrincipal);
      out.monthlyPaymentCents = centsFromInput(values.monthlyPayment);
      out.loanTermMonths = intFromString(values.loanTermMonths);
      out.loanStartedAt = values.loanStartedAt?.trim() || null;
      // 4K: loan needs paymentDueDay to participate in the cash-flow forecast.
      out.paymentDueDay = intFromString(values.paymentDueDay);
      out.institution = values.institution?.trim() || null;
      break;
  }
  // Drop undefined keys to keep the payload tidy.
  for (const k of Object.keys(out)) {
    if (typeof out[k] === "undefined") delete out[k];
  }
  return out;
}

function DetailsSection({
  type,
  form,
  mode
}: {
  type: AccountType;
  form: ReturnType<typeof useForm<AccountFormValues>>;
  mode: "create" | "edit";
}) {
  if (type === "other" || type === "cash") {
    return <InstitutionField form={form} />;
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Details (optional)
      </p>

      {(type === "savings" || type === "credit" || type === "loan") && (
        <FormField
          control={form.control}
          name="rate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{type === "savings" ? "APY" : "APR"} (percent)</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="4.5" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {type === "credit" && (
        <>
          <FormField
            control={form.control}
            name="creditLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Credit limit</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="2000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="statementDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Statement day</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} placeholder="15" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentDueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment due day</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} placeholder="5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )}

      {type === "loan" && (
        <>
          <FormField
            control={form.control}
            name="originalPrincipal"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Original principal</FormLabel>
                <FormControl>
                  <Input inputMode="decimal" placeholder="8000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="monthlyPayment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly payment</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" placeholder="350" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="loanTermMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Term (months)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="loanStartedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loan started on</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="paymentDueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment due day</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={31} placeholder="5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )}

      {type === "credit" && (
        <FormField
          control={form.control}
          name="monthlyPayment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Monthly payment (optional)</FormLabel>
              <FormControl>
                <Input inputMode="decimal" placeholder="50" {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                Used by the cash-flow forecast. Skip if you pay variable amounts.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {(type === "investment" || type === "crypto") && mode === "create" && (
        <FormField
          control={form.control}
          name="trackHoldings"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                <div>
                  <Label className="text-sm">Track individual holdings</Label>
                  <p className="text-xs text-muted-foreground">
                    Balance will derive from the sum of positions you log.
                  </p>
                </div>
                <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <InstitutionField form={form} />
    </div>
  );
}

function InstitutionField({
  form
}: {
  form: ReturnType<typeof useForm<AccountFormValues>>;
}) {
  return (
    <FormField
      control={form.control}
      name="institution"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Institution (optional)</FormLabel>
          <FormControl>
            <Input placeholder="Revolut, N26, Trade Republic, Coinbase…" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export type { AccountType };
