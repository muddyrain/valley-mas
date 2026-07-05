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
    <div className="relative min-h-screen bg-muted lg:flex">
      <div className="hidden lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:overflow-hidden lg:bg-[hsl(var(--color-card))] lg:px-14 lg:py-12">
        <div
          className="pointer-events-none absolute -right-24 -top-24 hidden h-80 w-80 rounded-full opacity-30 blur-3xl lg:block"
          style={{ background: `hsl(var(--primary))` }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 hidden h-64 w-64 rounded-full opacity-20 blur-3xl lg:block"
          style={{ background: `hsl(var(--primary))` }}
        />
        <div
          className="pointer-events-none absolute inset-0 hidden opacity-[0.04] lg:block"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.06) 1px, transparent 1px)',
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
              background: `hsl(var(--primary) / 0.18)`,
              color: `hsl(var(--primary))`,
              border: `1px solid hsl(var(--primary) / 0.35)`,
            }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: `hsl(var(--primary))` }}
            />
            {badge}
          </div>

          <h1 className="text-[2.4rem] font-black leading-[1.2] tracking-tight text-foreground">
            {heroTitle}
          </h1>

          <p className="max-w-xs text-[0.95rem] leading-7 text-muted-foreground">
            {heroDescription}
          </p>

          <div className="h-px w-12" style={{ background: `hsl(var(--primary) / 0.5)` }} />

          <div className="flex gap-8">
            {stats.map((item) => (
              <div key={item.label}>
                <div className="text-2xl font-black" style={{ color: `hsl(var(--primary))` }}>
                  {item.value}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-muted-foreground">© 2025 Valley · 保留所有权利</div>
      </div>

      <div className="flex min-h-screen w-full items-center justify-center px-4 py-6 sm:px-6 lg:w-[56%] lg:p-6">
        <div className="w-full max-w-md">
          <div className="mb-4 rounded-[28px] border border-border bg-[linear-gradient(160deg,hsl(var(--card)/0.94),hsl(var(--primary) / 0.10),hsl(var(--primary) / 0.08))] p-4 shadow-sm lg:hidden">
            <BrandLogo
              className="justify-center"
              iconClassName="h-12 w-12"
              wordmarkClassName="text-[1.45rem]"
            />
            <div className="mt-4 space-y-3">
              <div className="inline-flex items-center rounded-full border border-border bg-card/86 px-3 py-1 text-[11px] tracking-[0.16em] text-primary uppercase">
                {badge}
              </div>
              <div className="text-xl font-bold leading-8 text-foreground">{heroTitle}</div>
              <p className="text-sm leading-7 text-muted-foreground">{heroDescription}</p>
              <div className="grid grid-cols-3 gap-2">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/50 bg-card/84 px-3 py-3 text-center shadow-sm"
                  >
                    <div className="text-sm font-semibold text-primary">{item.value}</div>
                    <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] bg-card p-5 shadow-sm ring-1 ring-border/80 sm:p-8">
            <div className="mb-6 sm:mb-7">
              <h2 className="text-2xl font-bold text-foreground">{cardTitle}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{cardDescription}</p>
            </div>

            {children}

            <div className="mt-6 border-t border-border pt-5 text-center text-sm">{footer}</div>
          </div>

          <p className="mt-5 text-center text-xs leading-6 text-muted-foreground sm:mt-6">
            {bottomNote}
          </p>
        </div>
      </div>
    </div>
  );
}
