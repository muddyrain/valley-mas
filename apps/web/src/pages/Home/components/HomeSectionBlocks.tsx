import { Heart } from 'lucide-react';
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
        <div className="inline-flex items-center rounded-full border border-accent bg-accent px-4 py-1.5 text-[11px] tracking-[0.24em] text-primary uppercase">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {title}
          </h2>
          {description ? <p className="max-w-2xl text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 h-1 w-12 rounded-full bg-primary" />
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
    <div className="inline-flex w-full items-center gap-3 rounded-full border border-border bg-card px-4 py-2 sm:w-auto">
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent text-primary">
        {icon}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-[11px] tracking-[0.16em] text-muted-foreground uppercase">{label}</div>
        <div className="line-clamp-1 text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
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
    <div className="rounded-xl border border-dashed border-border bg-card px-8 py-12 text-center">
      <div className="mx-auto max-w-xl space-y-3">
        <h3 className="text-xl font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
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
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full border border-border transition ${
        active
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-muted text-foreground hover:bg-muted/80'
      }`}
      aria-label={active ? '取消收藏' : '收藏资源'}
    >
      <Heart className={`${iconClass} ${active ? 'fill-current' : ''}`} />
    </button>
  );
}
