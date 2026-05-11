"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setAiMonthlyCap } from "@/app/(app)/settings/actions";
import { formatCents } from "@/lib/money/format";

export function AiUsageCard({
  spendCents,
  capCents,
  currency,
  aiAvailable
}: {
  spendCents: number;
  capCents: number;
  currency: string;
  aiAvailable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(Math.round(capCents / 100)));
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  const capHit = spendCents >= capCents;

  function save() {
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0 || n > 100_00) {
      toast.error("Use 0–100.");
      return;
    }
    setSaving(true);
    startTransition(async () => {
      try {
        await setAiMonthlyCap({ cents: n * 100 });
        toast.success("Cap updated.");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save.");
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden />
          AI usage
        </CardTitle>
        <CardDescription>
          {aiAvailable
            ? "Briefings, reviews, and tiny-first-step suggestions can be written by Haiku 4.5. Templates take over if this monthly cap is hit."
            : "ANTHROPIC_API_KEY isn't set, so AI features are off. Templates run for every feature regardless."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">This month</span>
            <span className="font-medium tabular-nums">
              {formatCents(spendCents, currency)} of {formatCents(capCents, currency)} used
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={capHit ? "h-full bg-amber-500" : "h-full bg-stone-500"}
              style={{
                width: `${Math.min(100, Math.round((spendCents / Math.max(capCents, 1)) * 100))}%`
              }}
            />
          </div>
          {capHit && aiAvailable && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              AI features paused for the month — templates still work. Raise the cap if you want
              more.
            </p>
          )}
        </div>

        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="ai-cap">
              Monthly cap
            </label>
            <Input
              id="ai-cap"
              type="number"
              min={0}
              max={100}
              className="h-8 w-24"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">{currency}</span>
            <Button size="sm" onClick={save} disabled={saving || pending}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setDraft(String(Math.round(capCents / 100)));
              setEditing(true);
            }}
          >
            Monthly cap: {formatCents(capCents, currency)} — edit
          </button>
        )}
      </CardContent>
    </Card>
  );
}
