"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HEALTH_COPY } from "@/lib/health/copy";
import { setSleepTarget } from "@/app/(app)/health/actions";

export function SleepTargetEditor({
  sleepTargetHours
}: {
  sleepTargetHours: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(sleepTargetHours === null ? "" : String(sleepTargetHours));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const trimmed = draft.trim();
      if (!trimmed) {
        await setSleepTarget({ hours: null });
      } else {
        const n = Number(trimmed.replace(",", "."));
        if (!Number.isFinite(n) || n <= 0 || n > 24) {
          toast.error("Use 0–24 hours.");
          return;
        }
        await setSleepTarget({ hours: n });
      }
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(sleepTargetHours === null ? "" : String(sleepTargetHours));
          setEditing(true);
        }}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {HEALTH_COPY.sleep.targetEditorLabel}:{" "}
        {sleepTargetHours === null ? "not set" : `${sleepTargetHours}h`} — edit
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="sleep-target">
          {HEALTH_COPY.sleep.targetEditorLabel}
        </label>
        <Input
          id="sleep-target"
          inputMode="decimal"
          className="h-8 w-24"
          placeholder="7"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">hours</span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{HEALTH_COPY.sleep.targetEditorHelp}</p>
    </div>
  );
}
