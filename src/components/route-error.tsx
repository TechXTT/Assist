"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shared error boundary fallback for app-routes. Renders friendly inline
 * copy, logs the error to the console for dev debugging, and offers a
 * one-click reset.
 */
export function RouteError({
  error,
  reset,
  title = "Something glitched"
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error("[route-error]", error);
  }, [error]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Something didn't load right. Refresh, and if it sticks around, check the console.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Ref: {error.digest}</p>
        )}
        <Button size="sm" onClick={reset}>
          Reload
        </Button>
      </CardContent>
    </Card>
  );
}
