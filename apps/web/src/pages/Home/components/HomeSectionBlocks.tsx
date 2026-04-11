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
        <div className="theme-eyebrow inline-flex items-center rounded-full border bg-white/88 px-4 py-1.5 text-[11px] tracking-[0.3em] uppercase shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur">
          {eyebrow}
        </div>
        <div className="space-y-2">
          <h2 className="text-[36px] font-semibold tracking-[-0.045em] text-slate-950 md:text-[46px]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-[15px] leading-8 text-slate-500 md:text-base">
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
    <div className="group relative overflow-hidden rounded-[26px] border border-white/82 bg-[linear-gradient(140deg,rgba(255,255,255,0.9),rgba(255,255,255,0.72))] p-4 shadow-[0_18px_48px_rgba(var(--theme-primary-rgb),0.12)] backdrop-blur-md transition duration-300 hover:-translate-y-1.5 hover:border-white hover:shadow-[0_28px_64px_rgba(var(--theme-primary-rgb),0.2)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-white/50 blur-xl transition duration-500 group-hover:scale-125" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent_14%,rgba(255,255,255,0.48)_52%,transparent_86%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.95),transparent)]" />
      <div className={`mb-3 h-1.5 w-16 rounded-full ${accent}`} />
      <div className="text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
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
    <div className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full border border-white/88 bg-[linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,255,255,0.72))] px-4 py-2 shadow-[0_14px_36px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-white hover:shadow-[0_18px_42px_rgba(var(--theme-primary-rgb),0.2)]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,transparent_18%,rgba(255,255,255,0.46)_52%,transparent_82%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-theme-soft text-theme-primary shadow-[0_8px_20px_rgba(var(--theme-primary-rgb),0.18)]">
        {icon}
      </div>
      <div className="relative leading-tight">
        <div className="text-[11px] tracking-[0.16em] text-slate-400 uppercase">{label}</div>
        <div className="text-sm font-medium text-slate-900">{value}</div>
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
      'bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(var(--theme-primary-rgb),0.12),rgba(var(--theme-tertiary-rgb),0.10))]',
    secondary:
      'bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(var(--theme-secondary-rgb),0.16),rgba(var(--theme-primary-rgb),0.10))]',
    tertiary:
      'bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(var(--theme-tertiary-rgb),0.16),rgba(var(--theme-primary-rgb),0.08))]',
  };
  const toneGlowMap: Record<'primary' | 'secondary' | 'tertiary', string> = {
    primary: 'bg-[rgba(var(--theme-primary-rgb),0.26)]',
    secondary: 'bg-[rgba(var(--theme-secondary-rgb),0.26)]',
    tertiary: 'bg-[rgba(var(--theme-tertiary-rgb),0.26)]',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-[24px] border border-white/84 px-4 py-4 text-left shadow-[0_14px_34px_rgba(var(--theme-primary-rgb),0.12)] transition-all duration-300 hover:-translate-y-1.5 hover:border-white hover:shadow-[0_24px_56px_rgba(var(--theme-primary-rgb),0.22)] ${toneClassMap[tone]}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_16%,rgba(255,255,255,0.5)_52%,transparent_88%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,rgba(var(--theme-primary-rgb),0.65),transparent)]" />
      <div
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl transition-transform duration-500 group-hover:scale-125 ${toneGlowMap[tone]}`}
      />

      <div className="relative mb-3 flex items-center justify-between">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/75 bg-white/82 text-theme-primary shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.2)]">
          {icon}
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/84 px-2.5 py-1 text-[11px] tracking-[0.12em] text-slate-500 uppercase transition group-hover:text-theme-primary">
          GO
          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
        </div>
      </div>

      <div className="relative text-sm font-semibold text-slate-900">{title}</div>
      <div className="relative mt-1 text-xs leading-6 text-slate-600">{description}</div>
      <div className="relative mt-3 inline-flex items-center gap-2 text-xs text-theme-primary">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-theme-primary shadow-[0_0_0_4px_rgba(var(--theme-primary-rgb),0.15)]" />
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
    <div className="rounded-[32px] border border-dashed border-theme-shell-border bg-white/70 px-8 py-12 text-center shadow-[0_20px_56px_rgba(var(--theme-primary-rgb),0.1)] backdrop-blur">
      <div className="mx-auto max-w-xl space-y-3">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-7 text-slate-500">{description}</p>
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
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full border border-white/70 backdrop-blur transition ${
        active
          ? 'bg-rose-500 text-white shadow-[0_8px_20px_rgba(244,63,94,0.32)]'
          : 'bg-black/22 text-white hover:bg-black/34'
      }`}
      aria-label={active ? '鍙栨秷鏀惰棌' : '鏀惰棌璧勬簮'}
    >
      <Heart className={`${iconClass} ${active ? 'fill-current' : ''}`} />
    </button>
  );
}
