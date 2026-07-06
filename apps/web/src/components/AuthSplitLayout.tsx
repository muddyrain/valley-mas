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
      <div className="hidden lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:overflow-hidden lg:bg-card lg:px-14 lg:py-12">
        <Link to="/blog" className="relative flex w-fit items-center gap-3 group">
          <BrandLogo
            tone="light"
            iconClassName="h-10 transition-all group-hover:scale-105"
            wordmarkClassName="text-[1.22rem]"
          />
        </Link>

        <div className="relative space-y-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {badge}
          </div>

          <h1 className="text-[2.4rem] font-black leading-[1.2] tracking-tight text-foreground">
            {heroTitle}
          </h1>

          <p className="max-w-xs text-[0.95rem] leading-7 text-muted-foreground">
            {heroDescription}
          </p>

          <div className="h-px w-12 bg-primary/50" />

          <div className="flex gap-8">
            {stats.map((item) => (
              <div key={item.label}>
                <div className="text-2xl font-black text-primary">{item.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-xs text-muted-foreground">© 2025 Valley · 保留所有权利</div>
      </div>

      <div className="flex min-h-screen w-full items-center justify-center px-4 py-6 sm:px-6 lg:w-[56%] lg:p-6">
        <div className="w-full max-w-md">
          <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm lg:hidden">
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

          <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/80 sm:p-8">
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
