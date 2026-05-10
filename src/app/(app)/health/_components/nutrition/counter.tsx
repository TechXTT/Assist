"use client";

import { useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function Counter({
  label,
  value,
  onBump
}: {
  label: string;
  value: number;
  onBump: (delta: number) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  function bump(delta: number) {
    if (delta < 0 && value <= 0) return;
    startTransition(async () => {
      try {
        await onBump(delta);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={`Decrement ${label}`}
          disabled={pending || value <= 0}
          onClick={() => bump(-1)}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-6 text-center text-base font-semibold tabular-nums">{value}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={`Increment ${label}`}
          disabled={pending}
          onClick={() => bump(1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
