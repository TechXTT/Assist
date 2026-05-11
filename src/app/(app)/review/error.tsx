"use client";

import { RouteError } from "@/components/route-error";

export default function ReviewError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} title="Review didn't load" />;
}
