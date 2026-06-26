import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { ActionLoadingIcon } from './ActionLoadingIcon';
import { Card } from './ui/card';

type SkeletonTone = ComponentProps<typeof ActionLoadingIcon>['tone'];

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-full bg-muted motion-reduce:animate-none', className)}
    />
  );
}

export function ListCardSkeleton({ media = false, rows = 3 }: { media?: boolean; rows?: number }) {
  return (
    <div className="grid gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <Card key={index} className="overflow-hidden p-4">
          <div className="flex gap-3">
            {media ? (
              <SkeletonBar className="h-24 w-24 shrink-0 rounded-[1.25rem] bg-secondary" />
            ) : (
              <SkeletonBar className="size-11 shrink-0 rounded-2xl bg-secondary" />
            )}
            <div className="min-w-0 flex-1 space-y-3 py-1">
              <div className="flex gap-2">
                <SkeletonBar className="h-5 w-16 bg-secondary" />
                <SkeletonBar className="h-5 w-20 bg-secondary" />
              </div>
              <SkeletonBar className="h-5 w-3/4" />
              <SkeletonBar className="h-3.5 w-full" />
              <SkeletonBar className="h-3.5 w-2/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function InlineRefreshStatus({
  className,
  tone = 'ai',
}: {
  className?: string;
  tone?: SkeletonTone;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute right-0 top-0 z-10 inline-flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur',
        className,
      )}
    >
      <ActionLoadingIcon className="size-3.5" tone={tone} />
      刷新中
    </div>
  );
}
