import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({
  title,
  blurb
}: {
  title: string;
  blurb: string;
}) {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="leading-relaxed">{blurb}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Building this in the next sub-phase. Spending is the foundation; the rest plug into it.
      </CardContent>
    </Card>
  );
}
