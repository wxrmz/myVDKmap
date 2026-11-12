import { Skeleton } from "@/components/ui/skeleton";

// Delay is CSS-only (fill-mode-both keeps cards hidden for 150 ms), so this works as a server component.
function SkeletonCards({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3 animate-in fade-in fill-mode-both delay-150 duration-300">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel-box flex flex-col gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ))}
    </div>
  );
}

export function PageLoading({ title, cards = 3 }: { title: string; cards?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <SkeletonCards count={cards} />
    </div>
  );
}

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-8 w-1/2 animate-in fade-in fill-mode-both delay-150 duration-300" />
      <SkeletonCards count={3} />
    </div>
  );
}
