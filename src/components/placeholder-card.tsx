import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlaceholderCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="leading-relaxed">{description}</CardDescription>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
