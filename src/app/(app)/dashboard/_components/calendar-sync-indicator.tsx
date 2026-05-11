"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { syncCalendarInBackground } from "@/app/(app)/dashboard/actions";

type State =
  | { kind: "idle" }
  | { kind: "syncing" }
  | { kind: "reauth" }
  | { kind: "failed" };

export function CalendarSyncIndicator() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "syncing" });
    syncCalendarInBackground()
      .then((result) => {
        if (cancelled) return;
        if (result === "synced") {
          setState({ kind: "idle" });
          router.refresh();
          return;
        }
        if (result === "reauth") {
          setState({ kind: "reauth" });
          return;
        }
        if (result === "failed") {
          setState({ kind: "failed" });
          return;
        }
        setState({ kind: "idle" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
    // Run exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === "idle") return null;

  if (state.kind === "syncing") {
    return (
      <p
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 text-xs text-muted-foreground motion-reduce:[&_svg]:animate-none"
      >
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden />
        Refreshing calendar…
      </p>
    );
  }

  if (state.kind === "failed") {
    return (
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Couldn't reach Google right now — showing the latest cached events.
      </p>
    );
  }

  return null; // reauth is handled by the standalone <ReauthBanner /> elsewhere
}
