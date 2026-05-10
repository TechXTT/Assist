"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HEALTH_COPY } from "@/lib/health/copy";

import { LogSleepDialog } from "@/app/(app)/health/_components/sleep/log-sleep-dialog";

export function LogSleepButton({ todayIso }: { todayIso: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />
        {HEALTH_COPY.sleep.addButton}
      </Button>
      <LogSleepDialog open={open} onOpenChange={setOpen} defaultDateIso={todayIso} />
    </>
  );
}
