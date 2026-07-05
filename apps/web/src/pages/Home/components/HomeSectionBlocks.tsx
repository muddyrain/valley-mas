import { ArrowRight, Heart } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="space-y-3">
        <div className="inline-flex items-center rounded-full border border-accent bg-accent/50 px-4 py-1.5 text-[11px] tracking-[0.24em] text-primary uppercase shadow-sm backdrop-blur sm:tracking-[0.3em]">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h2 className="text-[30px] font-semibold tracking-[-0.045em] text-foreground sm:text-[34px] md:text-[46px]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-[15px] leading-8 text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function HeroStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[26px] border border-border/50 bg-card p-4 shadow-sm backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:shadow-md">
      <div className={`mb-3 h-1.5 w-16 rounded-full ${accent}`} />
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

export function HeroRibbon({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative inline-flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-border/50 bg-card px-4 py-2.5 shadow-sm backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:w-auto sm:rounded-full sm:py-2">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary shadow-sm">
        {icon}
      </div>
      <div className="relative min-w-0 leading-tight">
        <div className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
        <div className="line-clamp-1 text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

export function QuickEntryCard({
  icon,
  title,
  description,
  onClick,
  tone = 'primary',
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  tone?: 'primary' | 'secondary' | 'tertiary';
}) {
  const toneClassMap: Record<'primary' | 'secondary' | 'tertiary', string> = {
    primary:
      'bg-[linear-gradient(145deg,hsl(var(--card) / 0.96),hsl(var(--primary) / 0.12),hsl(var(--accent) / 0.10))]',
    secondary:
      'bg-[linear-gradient(145deg,hsl(var(--card) / 0.96),hsl(var(--secondary) / 0.16),hsl(var(--primary) / 0.10))]',
    tertiary:
      'bg-[linear-gradient(145deg,hsl(var(--card) / 0.96),hsl(var(--accent) / 0.16),hsl(var(--primary) / 0.08))]',
  };
  const toneGlowMap: Record<'primary' | 'secondary' | 'tertiary', string> = {
    primary: 'bg-[hsl(var(--primary) / 0.26)]',
    secondary: 'bg-[hsl(var(--secondary) / 0.26)]',
    tertiary: 'bg-[hsl(var(--accent) / 0.26)]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[24px] border border-border/50 px-4 py-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-md ${toneClassMap[tone]}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,hsl(var(--primary) / 0.65),transparent)]" />
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125 ${toneGlowMap[tone]}`}
      />

      <div className="relative mb-3 flex items-center justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/50 bg-card/82 text-primary shadow-sm">
          {icon}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-card/84 px-2.5 py-1 text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition group-hover:text-primary">
          GO
          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="relative text-sm font-semibold text-foreground">{title}</div>
      <div className="relative mt-1 text-xs leading-6 text-muted-foreground">{description}</div>
      <div className="relative mt-3 inline-flex items-center gap-2 text-xs text-primary">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_4px_hsl(var(--primary) / 0.15)]" />
        立即进入
      </div>
    </button>
  );
}
export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[32px] border border-dashed border-border bg-card/70 px-8 py-12 text-center shadow-sm backdrop-blur">
      <div className="mx-auto max-w-xl space-y-3">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-7 text-muted-foreground">{description}</p>
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  );
}

export function ResourceFavoriteButton({
  active,
  onClick,
  size,
}: {
  active: boolean;
  onClick: (event: MouseEvent) => void;
  size: 'sm' | 'md';
}) {
  const sizeClassMap: Record<'sm' | 'md', string> = {
    sm: 'h-6.5 w-6.5',
    md: 'h-8.5 w-8.5',
  };
  const iconClassMap: Record<'sm' | 'md', string> = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
  };
  const sizeClass = sizeClassMap[size];
  const iconClass = iconClassMap[size];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full border border-card/70 backdrop-blur transition ${
        active
          ? 'bg-destructive text-destructive-foreground shadow-sm'
          : 'bg-[hsl(var(--color-background)/0.22)] text-foreground hover:bg-[hsl(var(--color-background)/0.34)]'
      }`}
      aria-label={active ? '取消收藏' : '收藏资源'}
    >
      <Heart className={`${iconClass} ${active ? 'fill-current' : ''}`} />
    </button>
  );
}
