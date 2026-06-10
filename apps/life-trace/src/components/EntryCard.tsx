import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type EntryTone = 'ai' | 'trace' | 'plan' | 'health' | 'alert' | 'default';

const toneClasses: Record<EntryTone, { card: string; icon: string; badge: EntryTone }> = {
  ai: {
    card: 'border-life-ai/20 shadow-[0_18px_54px_rgba(6,182,212,0.08)]',
    icon: 'bg-life-ai/10 text-life-ai',
    badge: 'ai',
  },
  trace: {
    card: 'border-life-trace/20 shadow-[0_18px_54px_rgba(16,185,129,0.08)]',
    icon: 'bg-life-trace/10 text-life-trace',
    badge: 'trace',
  },
  plan: {
    card: 'border-life-plan/20 shadow-[0_18px_54px_rgba(139,92,246,0.08)]',
    icon: 'bg-life-plan/10 text-life-plan',
    badge: 'plan',
  },
  health: {
    card: 'border-life-health/20 shadow-[0_18px_54px_rgba(245,158,11,0.08)]',
    icon: 'bg-life-health/10 text-life-health',
    badge: 'health',
  },
  alert: {
    card: 'border-life-alert/20 shadow-[0_18px_54px_rgba(249,115,22,0.08)]',
    icon: 'bg-life-alert/10 text-life-alert',
    badge: 'alert',
  },
  default: {
    card: 'border-border',
    icon: 'bg-secondary text-muted-foreground',
    badge: 'default',
  },
};

type EntryCardProps = Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> & {
  icon: LucideIcon;
  badge: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  tone?: EntryTone;
  onClick: () => void;
  children?: ReactNode;
};

type ActionTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  icon?: LucideIcon;
  title: ReactNode;
  variant?: 'primary' | 'outline';
};

export function EntryCard({
  icon: Icon,
  badge,
  title,
  description,
  meta,
  tone = 'default',
  onClick,
  className,
  children,
  ...props
}: EntryCardProps) {
  const styles = toneClasses[tone];

  return (
    <Card className={cn('relative overflow-hidden p-4', styles.card, className)} {...props}>
      <button type="button" className="flex w-full items-center gap-3 text-left" onClick={onClick}>
        <div className={cn('grid size-12 shrink-0 place-items-center rounded-2xl', styles.icon)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={styles.badge}>{badge}</Badge>
            {meta ? <span className="text-xs text-muted-foreground">{meta}</span> : null}
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </button>
      {children}
    </Card>
  );
}

export function ActionTile({
  icon: Icon,
  title,
  variant = 'outline',
  className,
  ...props
}: ActionTileProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition',
        variant === 'primary'
          ? 'bg-life-ai text-background hover:bg-life-ai/90'
          : 'border border-border text-foreground hover:bg-secondary',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <span className="truncate">{title}</span>
    </button>
  );
}
