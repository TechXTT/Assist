"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents, parseCentsInput } from "@/lib/money/format";
import { setCashFlowTightThreshold } from "@/app/(app)/money/actions";

export function ThresholdInput({
  thresholdCents,
  currency
}: {
  thresholdCents: number;
  currency: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState((thresholdCents / 100).toString());
  const [pending, start] = useTransition();

  function commit() {
    const cents = parseCentsInput(value);
    if (cents === null || cents < 0) {
      toast.error("That doesn't look like a number.");
      return;
    }
    start(async () => {
      try {
        await setCashFlowTightThreshold(cents);
        toast.success("Threshold updated.");
        setEditing(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't update.");
      }
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted/60"
      >
        <span className="text-muted-foreground">Alert below:</span>
        <span className="tabular-nums">{formatCents(thresholdCents, currency)}</span>
        <Pencil className="h-3 w-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setEditing(false);
            setValue((thresholdCents / 100).toString());
          }
        }}
        className="h-8 w-24 text-xs"
        autoFocus
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => {
          setEditing(false);
          setValue((thresholdCents / 100).toString());
        }}
        disabled={pending}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button type="button" size="icon" className="h-7 w-7" onClick={commit} disabled={pending}>
        <Check className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
