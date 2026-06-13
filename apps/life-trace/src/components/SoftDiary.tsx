import type { LucideIcon } from 'lucide-react';
import { ChevronRight, Leaf } from 'lucide-react';
import type { ReactNode } from 'react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

type SoftTone = 'trace' | 'plan' | 'ai' | 'health' | 'weather' | 'alert' | 'muted';

const toneClass: Record<SoftTone, string> = {
  trace: 'text-life-trace bg-life-trace/10 border-life-trace/20',
  plan: 'text-life-plan bg-life-plan/10 border-life-plan/20',
  ai: 'text-life-ai bg-life-ai/10 border-life-ai/20',
  health: 'text-life-health bg-life-health/10 border-life-health/20',
  weather: 'text-life-weather bg-life-weather/10 border-life-weather/20',
  alert: 'text-life-alert bg-life-alert/10 border-life-alert/20',
  muted: 'text-muted-foreground bg-secondary border-border',
};

export const SoftPage = forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
  function SoftPage({ children, className }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'life-soft-page min-w-0 space-y-6 overflow-x-hidden px-5 pt-4 max-[360px]:px-4',
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

export function SoftHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 pb-0.5', className)}>
      <div className="min-w-0">
        <h1 className="flex min-w-0 items-center gap-2 text-[2.05rem] font-semibold leading-tight tracking-normal text-foreground max-[360px]:text-[1.8rem]">
          <span className="truncate">{title}</span>
          <Leaf className="size-6 shrink-0 text-life-trace max-[360px]:size-5" />
        </h1>
        {subtitle ? (
          <p className="mt-2 text-[0.95rem] leading-6 text-muted-foreground max-[360px]:text-sm">
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-1">{action}</div> : null}
    </div>
  );
}

export function SoftPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'rounded-[1.45rem] border border-border/80 bg-card/85 p-5 shadow-[0_18px_48px_rgba(71,58,42,0.065)] backdrop-blur',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SoftSectionTitle({
  title,
  meta,
  className,
}: {
  title: string;
  meta?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-1', className)}>
      <h2 className="text-[1.22rem] font-semibold leading-tight text-foreground">{title}</h2>
      {meta ? (
        <span className="text-[0.8rem] font-medium text-muted-foreground">{meta}</span>
      ) : null}
    </div>
  );
}

export function SoftStatGrid({
  items,
  columns = 3,
}: {
  items: Array<{
    label: string;
    value: ReactNode;
    icon?: LucideIcon;
    tone?: SoftTone;
    sublabel?: string;
  }>;
  columns?: 3 | 4;
}) {
  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-[1.45rem] border border-border/75 bg-card/85 shadow-[0_16px_44px_rgba(71,58,42,0.055)]',
        columns === 4 ? 'grid-cols-4' : 'grid-cols-3',
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const tone = item.tone ?? 'trace';
        return (
          <div
            key={`${item.label}-${index}`}
            className={cn(
              'min-w-0 px-3 py-[1.125rem] text-center',
              index > 0 && 'border-l border-border/70',
            )}
          >
            {Icon ? (
              <span
                className={cn(
                  'mx-auto mb-3 grid size-[2.9rem] place-items-center rounded-full border',
                  toneClass[tone],
                )}
              >
                <Icon className="size-[1.32rem]" />
              </span>
            ) : null}
            <div className="text-[1.52rem] font-semibold leading-none text-foreground">
              {item.value}
            </div>
            <p className="mt-2 truncate text-[0.9rem] font-medium text-muted-foreground">
              {item.label}
            </p>
            {item.sublabel ? (
              <p className="mt-1 truncate text-xs text-muted-foreground/80">{item.sublabel}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SoftIconBadge({
  icon: Icon,
  tone = 'trace',
  className,
}: {
  icon: LucideIcon;
  tone?: SoftTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid size-[3.25rem] shrink-0 place-items-center rounded-[1.05rem] border',
        toneClass[tone],
        className,
      )}
    >
      <Icon className="size-[1.35rem]" />
    </span>
  );
}

export function SoftListRow({
  icon,
  title,
  subtitle,
  meta,
  tone = 'trace',
  onClick,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  tone?: SoftTone;
  onClick?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <SoftIconBadge icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.02rem] font-semibold text-foreground">{title}</span>
        {subtitle ? (
          <span className="mt-1.5 block truncate text-sm text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
      {meta ? (
        <span className="shrink-0 text-[0.88rem] font-medium text-muted-foreground">{meta}</span>
      ) : null}
      <ChevronRight className="size-5 shrink-0 text-muted-foreground/85" />
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(
          'flex min-h-[4.75rem] w-full items-center gap-3.5 border-b border-border/65 py-3.5 text-left last:border-b-0',
          className,
        )}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-[4.75rem] items-center gap-3.5 border-b border-border/65 py-3.5 last:border-b-0',
        className,
      )}
    >
      {content}
    </div>
  );
}
