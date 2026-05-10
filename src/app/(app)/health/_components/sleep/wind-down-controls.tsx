"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { HEALTH_COPY } from "@/lib/health/copy";
import { setWindDownPrefs } from "@/app/(app)/health/actions";

export function WindDownControls({
  enabled,
  targetBedtime,
  minutesBefore
}: {
  enabled: boolean;
  targetBedtime: string | null;
  minutesBefore: number;
}) {
  const [localEnabled, setLocalEnabled] = useState(enabled);
  const [localBedtime, setLocalBedtime] = useState(targetBedtime ?? "");
  const [localMinutes, setLocalMinutes] = useState(String(minutesBefore));
  const [saving, setSaving] = useState(false);

  async function save(nextEnabled = localEnabled) {
    setSaving(true);
    try {
      const bedtime = localBedtime.trim() || null;
      const n = Number.parseInt(localMinutes, 10);
      if (!Number.isFinite(n) || n < 5 || n > 180) {
        toast.error("Minutes before: 5–180.");
        return;
      }
      if (nextEnabled && !bedtime) {
        toast.error("Set a target bedtime to enable wind-down.");
        return;
      }
      await setWindDownPrefs({
        enabled: nextEnabled,
        targetBedtime: bedtime,
        minutesBefore: n
      });
      toast.success("Saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{HEALTH_COPY.sleep.windDownLabel}</p>
          <p className="text-xs text-muted-foreground">{HEALTH_COPY.sleep.windDownHelp}</p>
        </div>
        <Switch
          checked={localEnabled}
          disabled={saving}
          onCheckedChange={(v) => {
            setLocalEnabled(v);
            void save(v);
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">{HEALTH_COPY.sleep.bedtimeLabel}</span>
          <Input
            type="time"
            value={localBedtime}
            onChange={(e) => setLocalBedtime(e.target.value)}
            disabled={saving}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">
            {HEALTH_COPY.sleep.minutesBeforeLabel}
          </span>
          <Input
            type="number"
            min={5}
            max={180}
            value={localMinutes}
            onChange={(e) => setLocalMinutes(e.target.value)}
            disabled={saving}
          />
        </label>
      </div>

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
