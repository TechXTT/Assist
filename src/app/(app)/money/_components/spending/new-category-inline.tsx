"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory } from "@/app/(app)/money/actions";

export const CATEGORY_COLORS = [
  "#a8a29e", // stone
  "#f59e0b", // amber
  "#ef4444", // red
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6" // teal
];

export function NewCategoryInline({
  onCreated,
  onCancel
}: {
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [pending, start] = useTransition();

  function submit() {
    if (!name.trim()) return;
    start(async () => {
      try {
        await createCategory({ name: name.trim(), color, monthlyLimitCents: 0 });
        toast.success("Added.");
        onCreated(name.trim());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't add that.");
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Category name"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") onCancel();
          }}
          className="h-9"
        />
        <Button type="button" size="icon" variant="ghost" onClick={onCancel} disabled={pending}>
          <X className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" onClick={submit} disabled={pending || !name.trim()}>
          <Check className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1.5">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            onClick={() => setColor(c)}
            className={cn(
              "h-5 w-5 rounded-full ring-offset-background transition-all",
              color === c && "ring-2 ring-foreground ring-offset-2"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}
