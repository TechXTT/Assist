"use client";

import { RouteError } from "@/components/route-error";

export default function MoneyError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} />;
}
