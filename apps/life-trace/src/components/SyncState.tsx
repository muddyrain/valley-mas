import { Cloud, RefreshCw } from 'lucide-react';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type SyncStateTone = 'ai' | 'trace' | 'plan' | 'health' | 'default';
type SyncStateVariant = 'card' | 'skeleton-list';

type SyncStateProps = {
  title: string;
  description?: string;
  tone?: SyncStateTone;
  variant?: SyncStateVariant;
  rows?: number;
  showRail?: boolean;
  className?: string;
};

const toneClassName: Record<SyncStateTone, { card: string; icon: string; rail: string }> = {
  ai: {
    card: 'border-life-ai/20 bg-life-ai/5',
    icon: 'bg-life-ai/10 text-life-ai',
    rail: 'bg-life-ai',
  },
  trace: {
    card: 'border-life-trace/20 bg-life-trace/5',
    icon: 'bg-life-trace/10 text-life-trace',
    rail: 'bg-life-trace',
  },
  plan: {
    card: 'border-life-plan/20 bg-life-plan/5',
    icon: 'bg-life-plan/10 text-life-plan',
    rail: 'bg-life-plan',
  },
  health: {
    card: 'border-life-health/20 bg-life-health/5',
    icon: 'bg-life-health/10 text-life-health',
    rail: 'bg-life-health',
  },
  default: {
    card: 'border-border bg-card',
    icon: 'bg-secondary text-muted-foreground',
    rail: 'bg-muted-foreground',
  },
};

function getLoadingTone(tone: SyncStateTone) {
  if (tone === 'trace' || tone === 'health') {
    return tone;
  }
  return 'ai';
}

export function SyncState({
  title,
  description,
  tone = 'default',
  variant = 'card',
  rows = 3,
  showRail = true,
  className,
}: SyncStateProps) {
  const toneClass = toneClassName[tone];

  if (variant === 'skeleton-list') {
    return (
      <div className={cn('space-y-3', className)} aria-live="polite" aria-busy="true">
        {Array.from({ length: rows }, (_, index) => (
          <Card key={index} className={cn('relative overflow-hidden p-4', toneClass.card)}>
            {showRail ? (
              <div className={cn('absolute inset-x-4 top-0 h-px', toneClass.rail)} />
            ) : null}
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-2xl',
                  toneClass.icon,
                )}
              >
                {index === 0 ? (
                  <ActionLoadingIcon tone={getLoadingTone(tone)} />
                ) : (
                  <Cloud className="size-4 opacity-70" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-3 w-28 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
                <div className="h-3 w-full animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-secondary motion-reduce:animate-none" />
              </div>
            </div>
            {index === 0 ? <span className="sr-only">{title}</span> : null}
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden p-4 text-sm text-muted-foreground shadow-sm',
        toneClass.card,
        className,
      )}
      aria-live="polite"
      aria-busy="true"
    >
      {showRail ? <div className={cn('absolute inset-x-4 top-0 h-px', toneClass.rail)} /> : null}
      <div className="flex items-center gap-3">
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-2xl', toneClass.icon)}>
          <ActionLoadingIcon tone={getLoadingTone(tone)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{title}</p>
          {description ? <p className="mt-1 leading-5">{description}</p> : null}
        </div>
        <RefreshCw className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
      </div>
    </Card>
  );
}

export function MessageSyncSkeleton({ className }: { className?: string }) {
  return (
    <SyncState title="正在同步云端对话" tone="ai" variant="skeleton-list" className={className} />
  );
}
