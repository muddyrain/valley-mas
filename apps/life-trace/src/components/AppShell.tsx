import {
  CalendarDays,
  ClipboardList,
  Download,
  MapPinned,
  RefreshCw,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import { gsap, useGSAP } from '@/lib/gsap';
import { getPwaShareFeedback } from '@/lib/pwa';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { AppTab } from '@/types';
import { Button } from './ui/button';

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

function getScrollRouteKey(pathname: string) {
  return pathname;
}

function isTabRoute(pathname: string) {
  return tabs.some((tab) => tab.path === pathname);
}

function scrollContentToTop(element: HTMLElement | null, _routeKey: string) {
  element?.scrollTo({ top: 0, behavior: 'instant' });
}

function PwaActionBanner({ hidden }: { hidden: boolean }) {
  const [dismissedKey, setDismissedKey] = useState('');
  const {
    canInstall,
    installed,
    iosInstallHint,
    refreshing,
    serviceWorkerReady,
    updateAvailable,
    promptInstall,
    refreshApp,
    shareApp,
  } = usePwaStatus();
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const bannerKey = updateAvailable ? 'update' : canInstall && !installed ? 'install' : '';

  if (hidden || !bannerKey || dismissedKey === bannerKey) {
    return null;
  }

  const handleShare = async () => {
    try {
      const result = await shareApp();
      const feedback = getPwaShareFeedback(result);
      showToast(feedback.message, feedback.tone);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '分享失败，请稍后再试', 'error');
    }
  };

  return (
    <div className="safe-x pointer-events-none fixed inset-x-0 bottom-[calc(6.9rem+env(safe-area-inset-bottom))] z-40 mx-auto w-full max-w-[430px]">
      <div className="pointer-events-auto rounded-[1.35rem] border border-life-ai/20 bg-card/95 p-3 shadow-[0_-18px_54px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
            {updateAvailable ? <RefreshCw className="size-5" /> : <Download className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {updateAvailable ? 'Life Trace 有新版本' : '安装 Life Trace'}
            </p>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {updateAvailable
                ? '刷新后可使用最新内容、应用名称和图标缓存。'
                : iosInstallHint
                  ? '当前设备可添加到主屏幕，后续从桌面图标打开。'
                  : '添加到桌面后，计划提醒和离线入口更稳定。'}
            </p>
          </div>
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            aria-label="暂时关闭"
            onClick={() => setDismissedKey(bannerKey)}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
          {updateAvailable ? (
            <Button
              type="button"
              variant="ai"
              size="sm"
              disabled={refreshing}
              onClick={() => void refreshApp()}
            >
              <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
              {refreshing ? '刷新中' : '立即更新'}
            </Button>
          ) : (
            <Button type="button" variant="ai" size="sm" onClick={() => void promptInstall()}>
              <Download className="size-4" />
              一键安装
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void handleShare()}>
            <Share2 className="size-4" />
            分享应用
          </Button>
        </div>
        {!serviceWorkerReady ? (
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            离线缓存还在准备，稍后会自动完成。
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);
  const scrollRouteKey = getScrollRouteKey(location.pathname);
  const isAgentChatRoute = location.pathname === '/ai';
  const showBottomNavigation = isTabRoute(location.pathname);
  const showBottomOverlay = showBottomNavigation && !isAgentChatRoute;
  const contentRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useLifeTraceEntrance(contentRef, {
    dependencies: [scrollRouteKey],
    selector: '[data-page-entrance]',
    y: 10,
    stagger: 0.035,
  });

  useEffect(() => {
    scrollContentToTop(contentRef.current, scrollRouteKey);
  }, [scrollRouteKey]);

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
    <div className="h-dvh w-full overflow-hidden bg-background text-foreground">
      <main
        ref={contentRef}
        className={cn(
          'safe-top mx-auto h-dvh w-full max-w-[430px] overflow-x-hidden overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isAgentChatRoute
            ? 'overflow-hidden px-0 pb-0'
            : showBottomNavigation
              ? 'safe-x overflow-y-auto pb-[calc(10rem+env(safe-area-inset-bottom))] max-[360px]:px-3'
              : 'safe-x overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-[360px]:px-3',
        )}
      >
        <div
          className={cn('min-w-0 overflow-x-hidden', isAgentChatRoute && 'h-full')}
          data-page-entrance
        >
          {children}
        </div>
      </main>
      {showBottomOverlay ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto h-[calc(11rem+env(safe-area-inset-bottom))] w-full max-w-[430px] bg-gradient-to-t from-background via-background via-55% to-transparent"
        />
      ) : null}
      <PwaActionBanner hidden={!showBottomOverlay} />
      {showBottomNavigation ? (
        <nav
          ref={navRef}
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-white/[0.07] bg-card/88 px-3 pt-3 shadow-[0_-18px_54px_rgba(0,0,0,0.38)] backdrop-blur-2xl max-[360px]:px-2"
        >
          <div className="grid grid-cols-5 items-stretch gap-1 rounded-[1.65rem] border border-white/[0.04] bg-background/28 p-1.5 max-[360px]:gap-0.5 max-[360px]:p-1">
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
                    'group relative inline-flex h-[4.1rem] min-w-0 shrink cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[1.25rem] border border-transparent px-1 text-sm font-medium text-muted-foreground transition duration-300 hover:bg-secondary/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-[360px]:h-[3.85rem]',
                    active &&
                      !isAi &&
                      'border-white/[0.10] bg-secondary/36 text-foreground shadow-[0_6px_18px_rgba(0,0,0,0.14)]',
                    isAi && 'hover:bg-life-ai/[0.045] hover:text-life-ai',
                    isAi &&
                      active &&
                      'border-life-ai/24 bg-life-ai/[0.045] text-life-ai shadow-[0_6px_20px_rgba(6,182,212,0.08)]',
                  )}
                >
                  <span
                    data-tab-icon
                    className={cn(
                      'relative z-10 grid size-8 place-items-center rounded-2xl transition duration-300 group-hover:-translate-y-0.5 group-hover:bg-secondary/55 group-hover:text-foreground',
                      isAi && 'text-life-ai group-hover:bg-life-ai/10 group-hover:text-life-ai',
                      active &&
                        'bg-background/72 text-foreground shadow-[0_5px_14px_rgba(0,0,0,0.14)]',
                      active && isAi && 'text-life-ai group-hover:bg-background/72',
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span
                    data-tab-label
                    className={cn(
                      'relative z-10 max-w-full truncate text-xs font-semibold transition duration-300',
                      'max-[360px]:text-[11px]',
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
      ) : null}
    </div>
  );
}
