"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HEALTH_COPY } from "@/lib/health/copy";
import { setWeeklyTarget } from "@/app/(app)/health/actions";

export function TargetEditor({
  weeklyTargetMinutes
}: {
  weeklyTargetMinutes: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(weeklyTargetMinutes));
  const [saving, setSaving] = useState(false);

  async function save() {
    const n = Number.parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Use a number ≥ 0.");
      return;
    }
    setSaving(true);
    try {
      await setWeeklyTarget({ minutes: n });
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
          setDraft(String(weeklyTargetMinutes));
          setEditing(true);
        }}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        {HEALTH_COPY.exercise.targetEditorLabel}: {weeklyTargetMinutes} min/week — edit
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-muted-foreground" htmlFor="exercise-target">
        {HEALTH_COPY.exercise.targetEditorLabel}
      </label>
      <Input
        id="exercise-target"
        type="number"
        min={0}
        className="h-8 w-24"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <span className="text-xs text-muted-foreground">min/week</span>
      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
        Cancel
      </Button>
    </div>
  );
}
