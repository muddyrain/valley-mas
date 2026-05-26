import { CalendarDays, ClipboardList, MapPinned, Sparkles, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
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

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <main className="mx-auto min-h-dvh w-full max-w-[430px] px-4 pb-32 pt-8">{children}</main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-border bg-card/95 px-4 pt-3 backdrop-blur">
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
