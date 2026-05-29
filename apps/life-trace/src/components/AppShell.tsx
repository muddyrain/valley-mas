import { CalendarDays, ClipboardList, MapPinned, Sparkles, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { gsap, useGSAP } from '@/lib/gsap';
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
  const navRef = useRef<HTMLElement>(null);

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

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const activeItem = navRef.current?.querySelector('[data-tab-active="true"]');
        if (!activeItem) {
          return;
        }

        gsap.fromTo(
          activeItem.querySelector('[data-tab-icon]'),
          { y: 6, scale: 0.86, autoAlpha: 0.76 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.36,
            ease: 'back.out(1.8)',
            clearProps: 'transform,opacity,visibility',
          },
        );
        gsap.fromTo(
          activeItem.querySelector('[data-tab-label]'),
          { y: 5, autoAlpha: 0.55 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.28,
            ease: 'power2.out',
            clearProps: 'transform,opacity,visibility',
          },
        );
      });

      return () => mm.revert();
    },
    { scope: navRef, dependencies: [activeTab], revertOnUpdate: true },
  );

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
      <nav
        ref={navRef}
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-white/[0.07] bg-card/88 px-3 pt-3 shadow-[0_-18px_54px_rgba(0,0,0,0.38)] backdrop-blur-2xl"
      >
        <div className="grid grid-cols-5 items-end gap-1 rounded-[1.65rem] border border-white/[0.04] bg-background/28 p-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const isAi = tab.id === 'ai';

            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                data-tab-active={active}
                className={cn(
                  'group relative inline-flex h-[4.35rem] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-visible whitespace-nowrap rounded-[1.25rem] border border-transparent px-1 text-sm font-medium text-muted-foreground transition duration-300 hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active &&
                    !isAi &&
                    'border-white/[0.10] bg-secondary/36 text-foreground shadow-[0_6px_18px_rgba(0,0,0,0.14)]',
                  isAi && '-mt-2 hover:bg-life-ai/[0.045] hover:text-life-ai',
                  isAi &&
                    active &&
                    'border-life-ai/24 bg-life-ai/[0.045] text-life-ai shadow-[0_6px_20px_rgba(6,182,212,0.08)]',
                )}
              >
                <span
                  data-tab-icon
                  className={cn(
                    'relative z-10 grid size-8 place-items-center rounded-2xl transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-secondary/55 group-hover:text-foreground',
                    isAi &&
                      'size-10 border border-life-ai/22 bg-background text-life-ai shadow-[0_8px_20px_rgba(6,182,212,0.10)] group-hover:bg-life-ai/10',
                    isAi &&
                      active &&
                      'border-life-ai/42 bg-life-ai/10 shadow-[0_6px_18px_rgba(6,182,212,0.14)]',
                    active &&
                      !isAi &&
                      'bg-background/72 text-foreground shadow-[0_5px_14px_rgba(0,0,0,0.14)]',
                  )}
                >
                  <Icon className={cn('size-5', isAi && 'size-[1.35rem]')} />
                </span>
                <span
                  data-tab-label
                  className={cn(
                    'relative z-10 text-xs font-semibold transition duration-300',
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
