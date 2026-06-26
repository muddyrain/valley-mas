import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type EmptyStateTone = 'ai' | 'trace' | 'plan' | 'health' | 'default';
type EmptyStateAlign = 'left' | 'center';

type EmptyStateProps = {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: LucideIcon;
  tone?: EmptyStateTone;
  align?: EmptyStateAlign;
  action?: ReactNode;
  className?: string;
};

const toneClassName: Record<
  EmptyStateTone,
  {
    card: string;
    icon: string;
    badge: 'ai' | 'trace' | 'plan' | 'health' | 'default';
  }
> = {
  ai: {
    card: 'border-border/80 bg-secondary/20',
    icon: 'border-life-ai/18 bg-life-ai/10 text-life-ai',
    badge: 'ai',
  },
  trace: {
    card: 'border-border/80 bg-secondary/20',
    icon: 'border-life-trace/18 bg-life-trace/10 text-life-trace',
    badge: 'trace',
  },
  plan: {
    card: 'border-border/80 bg-secondary/20',
    icon: 'border-life-plan/18 bg-life-plan/10 text-life-plan',
    badge: 'plan',
  },
  health: {
    card: 'border-border/80 bg-secondary/20',
    icon: 'border-life-health/18 bg-life-health/10 text-life-health',
    badge: 'health',
  },
  default: {
    card: 'border-dashed bg-card',
    icon: 'border-border bg-secondary text-muted-foreground',
    badge: 'default',
  },
};

export function EmptyState({
  title,
  description,
  eyebrow = '空状态',
  icon: Icon = Sparkles,
  tone = 'default',
  align = 'left',
  action,
  className,
}: EmptyStateProps) {
  const toneClass = toneClassName[tone];
  const centered = align === 'center';

  return (
    <Card
      className={cn(
        'relative overflow-hidden p-4 text-sm leading-6 text-muted-foreground shadow-sm',
        toneClass.card,
        centered && 'text-center',
        className,
      )}
    >
      <div className={cn('flex gap-4', centered ? 'flex-col items-center' : 'items-start')}>
        <div
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-2xl border',
            toneClass.icon,
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className={cn('min-w-0 flex-1', centered && 'max-w-[18rem]')}>
          <Badge tone={toneClass.badge} className="mb-3">
            {eyebrow}
          </Badge>
          <p className="text-base font-semibold leading-snug text-foreground">{title}</p>
          <p className="mt-2 text-sm leading-6">{description}</p>
          {action ? (
            <div className={cn('mt-4', centered && 'flex justify-center')}>{action}</div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
