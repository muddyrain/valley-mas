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
    rail: string;
    icon: string;
    badge: 'ai' | 'trace' | 'plan' | 'health' | 'default';
  }
> = {
  ai: {
    card: 'border-life-ai/25 bg-life-ai/5',
    rail: 'bg-life-ai',
    icon: 'border-life-ai/20 bg-life-ai/10 text-life-ai shadow-[0_14px_34px_rgba(6,182,212,0.16)]',
    badge: 'ai',
  },
  trace: {
    card: 'border-life-trace/25 bg-life-trace/5',
    rail: 'bg-life-trace',
    icon: 'border-life-trace/20 bg-life-trace/10 text-life-trace shadow-[0_14px_34px_rgba(34,197,94,0.14)]',
    badge: 'trace',
  },
  plan: {
    card: 'border-life-plan/25 bg-life-plan/5',
    rail: 'bg-life-plan',
    icon: 'border-life-plan/20 bg-life-plan/10 text-life-plan shadow-[0_14px_34px_rgba(168,85,247,0.14)]',
    badge: 'plan',
  },
  health: {
    card: 'border-life-health/25 bg-life-health/5',
    rail: 'bg-life-health',
    icon: 'border-life-health/20 bg-life-health/10 text-life-health shadow-[0_14px_34px_rgba(16,185,129,0.14)]',
    badge: 'health',
  },
  default: {
    card: 'border-dashed bg-card',
    rail: 'bg-muted-foreground',
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
        'relative overflow-hidden p-5 text-sm leading-6 text-muted-foreground shadow-sm',
        toneClass.card,
        centered && 'text-center',
        className,
      )}
    >
      <div className={cn('absolute inset-x-5 top-0 h-px', toneClass.rail)} />
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
