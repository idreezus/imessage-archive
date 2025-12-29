import { Skeleton } from "@/components/ui/skeleton";

export function SearchResultSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 py-3 px-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-12 ml-auto" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
