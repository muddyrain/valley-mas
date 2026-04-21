import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/BrandLogo';

interface AuthSplitLayoutProps {
  badge: string;
  heroTitle: ReactNode;
  heroDescription: string;
  stats: Array<{ value: string; label: string }>;
  cardTitle: string;
  cardDescription: string;
  children: ReactNode;
  footer: ReactNode;
  bottomNote: string;
}

export default function AuthSplitLayout({
  badge,
  heroTitle,
  heroDescription,
  stats,
  cardTitle,
  cardDescription,
  children,
  footer,
  bottomNote,
}: AuthSplitLayoutProps) {
  return (
    <div className="relative min-h-screen bg-slate-50 lg:flex">
      <div className="hidden lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:overflow-hidden lg:bg-slate-950 lg:px-14 lg:py-12">
        <div
          className="pointer-events-none absolute -right-24 -top-24 hidden h-80 w-80 rounded-full opacity-30 blur-3xl lg:block"
          style={{ background: `rgba(var(--theme-primary-rgb),1)` }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 hidden h-64 w-64 rounded-full opacity-20 blur-3xl lg:block"
          style={{ background: `rgba(var(--theme-secondary-rgb),1)` }}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden opacity-[0.04] lg:block"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <Link to="/blog" className="relative flex w-fit items-center gap-3 group">
          <BrandLogo
            tone="light"
            iconClassName="h-10 transition-all group-hover:scale-105"
            wordmarkClassName="text-[1.22rem]"
          />
        </Link>

        <div className="relative space-y-7">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: `rgba(var(--theme-primary-rgb),0.18)`,
              color: `rgba(var(--theme-primary-rgb),1)`,
              border: `1px solid rgba(var(--theme-primary-rgb),0.35)`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `rgba(var(--theme-primary-rgb),1)` }}
            />
            {badge}
          </div>

          <h1 className="text-[2.4rem] font-black leading-[1.2] tracking-tight text-white">
            {heroTitle}
          </h1>

          <p className="max-w-xs text-[0.95rem] leading-7 text-slate-400">{heroDescription}</p>

          <div className="h-px w-12" style={{ background: `rgba(var(--theme-primary-rgb),0.5)` }} />

          <div className="flex gap-8">
            {stats.map((item) => (
              <div key={item.label}>
                <div
                  className="text-2xl font-black"
                  style={{ color: `rgba(var(--theme-primary-rgb),1)` }}
                >
                  {item.value}
                </div>
                <div className="mt-1 text-xs text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-slate-600">© 2025 Valley · 保留所有权利</div>
      </div>

      <div className="flex min-h-screen w-full items-center justify-center px-4 py-6 sm:px-6 lg:w-[56%] lg:p-6">
        <div className="w-full max-w-md">
          <div className="mb-4 rounded-[28px] border border-theme-shell-border bg-[linear-gradient(160deg,rgba(255,255,255,0.94),rgba(var(--theme-primary-rgb),0.10),rgba(var(--theme-secondary-rgb),0.08))] p-4 shadow-[0_16px_36px_rgba(var(--theme-primary-rgb),0.12)] lg:hidden">
            <BrandLogo
              className="justify-center"
              iconClassName="h-12 w-12"
              wordmarkClassName="text-[1.45rem]"
            />
            <div className="mt-4 space-y-3">
              <div className="inline-flex items-center rounded-full border border-theme-shell-border bg-white/86 px-3 py-1 text-[11px] tracking-[0.16em] text-theme-primary uppercase">
                {badge}
              </div>
              <div className="text-xl font-bold leading-8 text-slate-900">{heroTitle}</div>
              <p className="text-sm leading-7 text-slate-500">{heroDescription}</p>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/80 bg-white/84 px-3 py-3 text-center shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)]"
                  >
                    <div className="text-sm font-semibold text-theme-primary">{item.value}</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,0.10)] ring-1 ring-slate-200/80 sm:p-8">
            <div className="mb-6 sm:mb-7">
              <h2 className="text-2xl font-bold text-slate-900">{cardTitle}</h2>
              <p className="mt-1.5 text-sm text-slate-500">{cardDescription}</p>
            </div>

            {children}

            <div className="mt-6 border-t border-theme-shell-border pt-5 text-center text-sm">
              {footer}
            </div>
          </div>

          <p className="mt-5 text-center text-xs leading-6 text-slate-400 sm:mt-6">{bottomNote}</p>
        </div>
      </div>
    </div>
  );
}
