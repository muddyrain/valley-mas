import { CalendarDays, ClipboardList, MapPinned, Sparkles, UserRound } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { AppTab } from '@/types';

const tabs: Array<{ id: AppTab; label: string; icon: typeof CalendarDays }> = [
  { id: 'today', label: '今日', icon: CalendarDays },
  { id: 'plans', label: '计划', icon: ClipboardList },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'traces', label: '踪迹', icon: MapPinned },
  { id: 'profile', label: '我的', icon: UserRound },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { activeTab, setActiveTab } = useLifeTraceStore();
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
        <div>{children}</div>
      </main>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto h-44 w-full max-w-[430px] bg-gradient-to-t from-background via-background via-55% to-transparent"
      />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-border bg-card px-4 pt-3 shadow-[0_-18px_50px_rgba(0,0,0,0.34)]">
        <div className="grid grid-cols-5 items-end gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const isAi = tab.id === 'ai';

            return (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                className={cn(
                  'h-auto flex-col gap-1 rounded-2xl px-1 py-2 text-muted-foreground',
                  active && !isAi && 'bg-secondary text-foreground',
                  isAi && '-mt-8',
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-2xl',
                    isAi &&
                      'size-14 bg-life-ai text-background shadow-[0_14px_45px_rgba(6,182,212,0.32)]',
                  )}
                >
                  <Icon className={cn('size-5', isAi && 'size-7')} />
                </span>
                <span className={cn('text-xs font-semibold', isAi && 'text-life-ai')}>
                  {tab.label}
                </span>
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
