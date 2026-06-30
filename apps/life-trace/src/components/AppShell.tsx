import {
  ClipboardList,
  Download,
  House,
  NotebookText,
  RefreshCw,
  Share2,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import {
  type MouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { usePwaStatus } from '@/hooks/usePwaStatus';
import {
  captureScrollMemory,
  getActiveLifeTraceTab,
  getLifeTraceScrollMemoryKey,
  isLifeTraceTabRoute,
  restoreScrollMemory,
  type ScrollMemoryEntry,
} from '@/lib/lifeTraceNavigation';
import { getPwaShareFeedback } from '@/lib/pwa';
import { cn } from '@/lib/utils';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import type { AppTab } from '@/types';
import { ActionLoadingIcon } from './ActionLoadingIcon';
import { Button } from './ui/button';

const tabs: Array<{ id: AppTab; label: string; path: string; icon: typeof House }> = [
  { id: 'today', label: '今日', path: '/today', icon: House },
  { id: 'plans', label: '计划', path: '/plans', icon: ClipboardList },
  { id: 'ai', label: 'AI', path: '/ai', icon: Sparkles },
  { id: 'traces', label: '踪迹', path: '/traces', icon: NotebookText },
  { id: 'profile', label: '我的', path: '/profile', icon: UserRound },
];

function BottomTabLink({
  active,
  icon: Icon,
  isCenter = false,
  label,
  onReselect,
  path,
}: {
  active: boolean;
  icon: typeof House;
  isCenter?: boolean;
  label: string;
  onReselect?: () => void;
  path: string;
}) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!active) {
      return;
    }
    event.preventDefault();
    onReselect?.();
  };

  if (isCenter) {
    return (
      <NavLink
        to={path}
        data-tab-active={active}
        className="group relative flex h-[4.55rem] min-w-0 items-start justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={handleClick}
      >
        <span
          data-tab-icon
          className={cn(
            'mt-0 grid size-[3.85rem] place-items-center rounded-full border border-white/55 bg-life-trace text-primary-foreground shadow-[0_12px_26px_rgba(78,143,104,0.28)] transition-colors duration-200 group-hover:bg-life-trace/95 max-[360px]:size-[3.55rem]',
            active && 'shadow-[0_13px_28px_rgba(78,143,104,0.34)]',
          )}
        >
          <span className="flex flex-col items-center justify-center gap-0.5">
            <Icon className="size-[1.45rem] fill-primary-foreground/15 stroke-[2.1]" />
            <span
              data-tab-label
              className="text-[0.76rem] font-semibold leading-none text-primary-foreground"
            >
              {label}
            </span>
          </span>
        </span>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={path}
      data-tab-active={active}
      className={cn(
        'group flex h-[4.15rem] min-w-0 flex-col items-center justify-end gap-1.5 rounded-2xl px-1 pb-1 text-muted-foreground transition-colors duration-200 hover:text-life-trace focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-[360px]:h-[3.95rem]',
        active && 'text-life-trace',
      )}
      onClick={handleClick}
    >
      <span data-tab-icon className="grid size-7 place-items-center transition-colors duration-200">
        <Icon className={cn('size-[1.48rem] stroke-[1.9]', active && 'stroke-[2]')} />
      </span>
      <span
        data-tab-label
        className="max-w-full truncate text-[0.78rem] font-medium leading-none tracking-normal"
      >
        {label}
      </span>
    </NavLink>
  );
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
    <div className="safe-x pointer-events-none fixed inset-x-0 bottom-[calc(6.9rem+env(safe-area-inset-bottom))] z-40 w-full">
      <div className="pointer-events-auto rounded-[1.25rem] border border-life-ai/20 bg-card/95 p-3 shadow-[0_-18px_54px_rgba(45,41,35,0.14)] backdrop-blur-2xl">
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
              {refreshing ? (
                <ActionLoadingIcon className="size-4" tone="ai" />
              ) : (
                <RefreshCw className="size-4" />
              )}
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
  const activeTab = getActiveLifeTraceTab(location.pathname);
  const scrollMemoryKey = getLifeTraceScrollMemoryKey(location.pathname);
  const routeViewKey = scrollMemoryKey ?? location.pathname;
  const isAgentChatRoute = location.pathname === '/ai';
  const showBottomNavigation = isLifeTraceTabRoute(location.pathname);
  const showBottomOverlay = showBottomNavigation && !isAgentChatRoute;
  const contentRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const scrollMemoryRef = useRef(new Map<string, ScrollMemoryEntry>());
  const activeScrollMemoryKeyRef = useRef(scrollMemoryKey);
  activeScrollMemoryKeyRef.current = scrollMemoryKey;

  useLifeTraceEntrance(contentRef, {
    dependencies: [routeViewKey],
    selector: '[data-page-entrance]',
    y: 10,
    stagger: 0.035,
  });

  const getEventScrollAnchor = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return null;
    }
    return target.closest<HTMLElement>('[data-scroll-anchor]');
  };

  const rememberCurrentScroll = (
    event?: MouseEvent<HTMLElement> | ReactPointerEvent<HTMLElement>,
  ) => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    const currentScrollMemoryKey = activeScrollMemoryKeyRef.current;
    if (!currentScrollMemoryKey) {
      return;
    }
    scrollMemoryRef.current.set(
      currentScrollMemoryKey,
      captureScrollMemory(
        element,
        currentScrollMemoryKey,
        getEventScrollAnchor(event?.target ?? null),
      ),
    );
  };

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    if (!scrollMemoryKey) {
      if (routeViewKey) {
        element.scrollTo({ top: 0, behavior: 'instant' });
      }
      return;
    }

    let cancelled = false;
    const restore = () => {
      if (cancelled) {
        return true;
      }
      return restoreScrollMemory(element, scrollMemoryRef.current.get(scrollMemoryKey));
    };

    restore();
    const frame = window.requestAnimationFrame(restore);
    const retryDelays = [80, 180, 360, 720];
    const timeouts = retryDelays.map((delay) =>
      window.setTimeout(() => {
        if (!restore()) {
          window.requestAnimationFrame(restore);
        }
      }, delay),
    );

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [routeViewKey, scrollMemoryKey]);

  useEffect(() => {
    const element = contentRef.current;
    if (!element || !scrollMemoryKey) {
      return;
    }

    let frame = 0;
    const scrollListenerMemoryKey = scrollMemoryKey;
    const remember = () => {
      if (activeScrollMemoryKeyRef.current !== scrollListenerMemoryKey) {
        return;
      }
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      frame = window.requestAnimationFrame(() => {
        if (activeScrollMemoryKeyRef.current !== scrollListenerMemoryKey) {
          return;
        }
        scrollMemoryRef.current.set(
          scrollListenerMemoryKey,
          captureScrollMemory(element, scrollListenerMemoryKey),
        );
      });
    };

    element.addEventListener('scroll', remember, { passive: true });

    return () => {
      element.removeEventListener('scroll', remember);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [scrollMemoryKey]);

  const handleTabReselect = () => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    element.scrollTo({ top: 0, behavior: 'smooth' });
    if (scrollMemoryKey) {
      scrollMemoryRef.current.set(scrollMemoryKey, {
        key: scrollMemoryKey,
        scrollTop: 0,
        anchorId: '',
        anchorOffsetTop: 0,
      });
    }
  };

  return (
    <div className="h-dvh w-full overflow-hidden bg-background text-foreground">
      <main
        ref={contentRef}
        onClickCapture={rememberCurrentScroll}
        onPointerDownCapture={rememberCurrentScroll}
        className={cn(
          'h-dvh w-full overflow-x-hidden overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          showBottomNavigation && 'life-soft-page',
          isAgentChatRoute
            ? 'overflow-hidden px-0 pb-0'
            : showBottomNavigation
              ? 'overflow-y-auto pb-[calc(5.35rem+env(safe-area-inset-bottom))]'
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
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-[calc(4.9rem+env(safe-area-inset-bottom))] w-full bg-gradient-to-t from-background via-background/35 via-42% to-transparent"
        />
      ) : null}
      <PwaActionBanner hidden={!showBottomOverlay} />
      {showBottomNavigation ? (
        <nav
          ref={navRef}
          className="life-soft-tabbar fixed inset-x-0 bottom-0 z-30 w-full border-t border-border/55 px-2 pt-1 [padding-bottom:max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-6px_18px_rgba(71,58,42,0.04)] backdrop-blur-xl max-[360px]:px-4"
        >
          <div className="grid h-[4.55rem] grid-cols-5 items-end gap-0.5">
            {tabs.map((tab) => (
              <BottomTabLink
                key={tab.id}
                active={activeTab === tab.id}
                icon={tab.icon}
                isCenter={tab.id === 'ai'}
                label={tab.label}
                onReselect={handleTabReselect}
                path={tab.path}
              />
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
