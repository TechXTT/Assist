import { Skeleton } from "@/components/ui/skeleton";

export default function HealthLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-10 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
}
