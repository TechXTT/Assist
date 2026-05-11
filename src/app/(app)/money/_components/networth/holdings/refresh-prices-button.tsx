"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { refreshPricesAction } from "@/app/(app)/money/actions";

export function RefreshPricesButton({ holdingCount }: { holdingCount: number }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshPricesAction();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      const parts = [`${result.updated} updated`];
      if (result.unchanged > 0) parts.push(`${result.unchanged} unchanged`);
      if (result.failed.length > 0) parts.push(`${result.failed.length} skipped`);
      toast.success(`Prices refreshed: ${parts.join(", ")}.`);
    });
  }

  if (holdingCount === 0) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Refreshing…" : "Refresh prices"}
    </Button>
  );
}
