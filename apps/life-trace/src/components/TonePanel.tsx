import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'ai' | 'trace' | 'plan' | 'health' | 'alert' | 'default';

const toneClasses: Record<Tone, { card: string; icon: string; badge: Tone }> = {
  ai: {
    card: 'border-life-ai/20 bg-life-ai/5',
    icon: 'bg-life-ai/10 text-life-ai',
    badge: 'ai',
  },
  trace: {
    card: 'border-life-trace/20 bg-life-trace/5',
    icon: 'bg-life-trace/10 text-life-trace',
    badge: 'trace',
  },
  plan: {
    card: 'border-life-plan/20 bg-life-plan/5',
    icon: 'bg-life-plan/10 text-life-plan',
    badge: 'plan',
  },
  health: {
    card: 'border-life-health/20 bg-life-health/5',
    icon: 'bg-life-health/10 text-life-health',
    badge: 'health',
  },
  alert: {
    card: 'border-life-alert/20 bg-life-alert/5',
    icon: 'bg-life-alert/10 text-life-alert',
    badge: 'alert',
  },
  default: {
    card: 'border-border bg-card',
    icon: 'bg-secondary text-muted-foreground',
    badge: 'default',
  },
};

type TonePanelProps = {
  tone?: Tone;
  icon?: LucideIcon;
  badge?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function TonePanel({
  tone = 'default',
  icon: Icon,
  badge,
  title,
  description,
  action,
  children,
  className,
}: TonePanelProps) {
  const styles = toneClasses[tone];

  return (
    <Card className={cn('relative overflow-hidden p-4 shadow-sm', styles.card, className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {Icon ? (
            <div
              className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', styles.icon)}
            >
              <Icon className="size-5" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {badge ? (
              <Badge tone={styles.badge} className="mb-2">
                {badge}
              </Badge>
            ) : null}
            {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
            {description ? (
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}
