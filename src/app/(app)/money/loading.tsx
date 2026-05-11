import { Skeleton } from "@/components/ui/skeleton";

export default function MoneyLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-56 w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  );
}
