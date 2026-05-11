"use client";

import { RouteError } from "@/components/route-error";

export default function BriefingError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Briefing didn't load" />;
}
