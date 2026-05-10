"use client";

import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

export function ReauthBanner({ className }: { className?: string }) {
  return (
    <div
      className={
        "flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100 " +
        (className ?? "")
      }
    >
      <span>Looks like Google forgot us — quick reconnect?</span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="border-amber-400/60 bg-background"
      >
        Reconnect
      </Button>
    </div>
  );
}
