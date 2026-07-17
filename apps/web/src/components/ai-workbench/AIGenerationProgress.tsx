import { Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function AIGenerationProgress({
  title = 'AI 正在生成',
  description = '正在理解需求并整理内容，完成后会显示可编辑结果。',
  compact = false,
  className,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-muted/30',
        compact ? 'p-3' : 'p-4',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <span className="absolute inset-0 animate-pulse rounded-lg bg-primary/10" />
          <Sparkles className="relative size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className={cn('space-y-2', compact ? 'mt-3' : 'mt-4')} aria-hidden="true">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        {!compact ? <Skeleton className="h-3 w-2/3" /> : null}
      </div>
    </div>
  );
}
