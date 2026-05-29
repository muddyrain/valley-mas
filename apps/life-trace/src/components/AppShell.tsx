import { CalendarDays, ClipboardList, MapPinned, Sparkles, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { cn } from '@/lib/utils';
import type { AppTab } from '@/types';

const tabs: Array<{ id: AppTab; label: string; path: string; icon: typeof CalendarDays }> = [
  { id: 'today', label: '今日', path: '/today', icon: CalendarDays },
  { id: 'plans', label: '计划', path: '/plans', icon: ClipboardList },
  { id: 'ai', label: 'AI', path: '/ai', icon: Sparkles },
  { id: 'traces', label: '踪迹', path: '/traces', icon: MapPinned },
  { id: 'profile', label: '我的', path: '/profile', icon: UserRound },
];

function getActiveTab(pathname: string): AppTab {
  if (pathname === '/plans' || pathname.startsWith('/plans/')) {
    return 'plans';
  }
  if (pathname === '/ai' || pathname.startsWith('/ai/')) {
    return 'ai';
  }
  if (pathname === '/traces' || pathname.startsWith('/traces/')) {
    return 'traces';
  }
  if (pathname === '/profile') {
    return 'profile';
  }
  return 'today';
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);
  const contentRef = useRef<HTMLElement>(null);

  useLifeTraceEntrance(contentRef, {
    dependencies: [activeTab],
    selector: '[data-page-entrance]',
    y: 10,
    stagger: 0.035,
  });

  useEffect(() => {
    if (activeTab) {
      contentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeTab]);

  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground">
      <main
        ref={contentRef}
        className="mx-auto h-dvh w-full max-w-[430px] overflow-y-auto overflow-x-hidden px-4 pb-44 pt-8"
      >
        <div data-page-entrance>{children}</div>
      </main>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto h-44 w-full max-w-[430px] bg-gradient-to-t from-background via-background via-55% to-transparent"
      />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-border bg-card/95 px-4 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.30)] backdrop-blur-xl">
        <div className="grid grid-cols-5 items-end gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const isAi = tab.id === 'ai';

            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={cn(
                  'inline-flex h-auto shrink-0 cursor-pointer flex-col items-center justify-center gap-1 whitespace-nowrap rounded-2xl px-1 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active && !isAi && 'bg-secondary/55 text-foreground',
                  isAi && '-mt-5 hover:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'relative grid size-8 place-items-center rounded-2xl transition',
                    isAi &&
                      'size-12 border border-life-ai/35 bg-background text-life-ai shadow-[0_12px_38px_rgba(6,182,212,0.18)]',
                    isAi &&
                      active &&
                      'border-life-ai/70 bg-life-ai/15 shadow-[0_10px_34px_rgba(6,182,212,0.24),0_0_0_6px_rgba(6,182,212,0.06)]',
                    active &&
                      !isAi &&
                      'bg-background text-foreground shadow-[0_8px_22px_rgba(0,0,0,0.22)]',
                  )}
                >
                  <Icon className={cn('size-5', isAi && 'size-6')} />
                  {isAi && active ? (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 size-1.5 rounded-full bg-life-ai shadow-[0_0_12px_rgba(6,182,212,0.9)]"
                    />
                  ) : null}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold transition',
                    active ? 'text-foreground' : 'text-muted-foreground',
                    isAi && active && 'text-life-ai',
                  )}
                >
                  {tab.label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
