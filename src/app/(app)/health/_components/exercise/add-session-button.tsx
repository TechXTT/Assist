"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HEALTH_COPY } from "@/lib/health/copy";

import { SessionDialog } from "@/app/(app)/health/_components/exercise/session-dialog";

export function AddSessionButton({ todayIso }: { todayIso: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" aria-hidden />
        {HEALTH_COPY.exercise.addButton}
      </Button>
      <SessionDialog
        mode="create"
        timezone="" /* unused in create */
        defaultDateIso={todayIso}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
