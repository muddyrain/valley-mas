import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DESKTOP_APP_LIST,
  type DesktopApp,
  type DesktopAppCategory,
  getDefaultWindowOptions,
} from '../apps/desktopApps';
import { useLaunchpadStore } from '../store/launchpadStore';
import { useWindowStore } from '../store/windowStore';
import { PlushPop, PlushPresence } from '../ui/PlushMotion';
import './Launchpad.css';

const DEFAULT_METRICS = { pageSize: 15, columns: 5 };
const SWIPE_PAGE_THRESHOLD = 92;
const SWIPE_VERTICAL_CANCEL = 86;

const CATEGORY_LABEL: Record<DesktopAppCategory, string> = {
  system: '系统',
  content: '内容',
  tool: '工具',
  game: '小游戏',
};

export default function Launchpad() {
  const isOpen = useLaunchpadStore((s) => s.isOpen);
  return (
    <PlushPresence>
      {isOpen ? (
        <PlushPop key="launchpad">
          <LaunchpadPanel />
        </PlushPop>
      ) : null}
    </PlushPresence>
  );
}

function LaunchpadPanel() {
  const isOpen = useLaunchpadStore((s) => s.isOpen);
  const query = useLaunchpadStore((s) => s.query);
  const setQuery = useLaunchpadStore((s) => s.setQuery);
  const close = useLaunchpadStore((s) => s.close);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const runningAppIds = useWindowStore((s) => s.runningAppIds);
  const prefersReduced = useReducedMotion() === true;
  const { pageSize, columns } = useLaunchpadMetrics();
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState(1);
  const [isSwipePressing, setIsSwipePressing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const swipeRef = useRef<LaunchpadSwipeState | null>(null);
  const runningApps = useMemo(() => new Set(runningAppIds), [runningAppIds]);

  const apps = useMemo(() => filterApps(query), [query]);
  const pages = useMemo(() => chunkApps(apps, pageSize), [apps, pageSize]);
  const pageCount = pages.length;
  const currentPage = pages[pageIndex] ?? [];
  const pageStartIndex = pageIndex * pageSize;

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
    setKeyboardActive(false);
    setPageIndex(0);
    setPageDirection(1);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (apps.length === 0) {
      setActiveIndex(0);
      setPageIndex(0);
      setKeyboardActive(false);
      return;
    }

    setActiveIndex((current) => Math.min(current, apps.length - 1));
    setPageIndex((current) => Math.min(current, Math.max(0, pageCount - 1)));
  }, [apps.length, pageCount]);

  function openApp(app: DesktopApp) {
    restoreOrFocus(app.id, getDefaultWindowOptions(app.id));
    close();
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setActiveIndex(0);
    setPageIndex(0);
    setPageDirection(1);
    setKeyboardActive(false);
  }

  function moveActive(delta: number) {
    if (apps.length === 0) return;
    const nextIndex = (activeIndex + delta + apps.length) % apps.length;
    const nextPage = Math.floor(nextIndex / pageSize);
    if (nextPage !== pageIndex) {
      setPageDirection(nextPage > pageIndex ? 1 : -1);
      setPageIndex(nextPage);
    }
    setKeyboardActive(true);
    setActiveIndex(nextIndex);
  }

  function goToPage(nextPage: number) {
    if (pageCount <= 1) return;
    const normalizedPage = (nextPage + pageCount) % pageCount;
    if (normalizedPage === pageIndex) return;
    const isForward =
      normalizedPage > pageIndex || (pageIndex === pageCount - 1 && normalizedPage === 0);
    setPageDirection(isForward ? 1 : -1);
    setPageIndex(normalizedPage);
    setActiveIndex(normalizedPage * pageSize);
    setKeyboardActive(false);
  }

  function endSwipeGesture(stage?: HTMLDivElement) {
    const swipe = swipeRef.current;
    if (stage && swipe?.pointerId != null && stage.hasPointerCapture(swipe.pointerId)) {
      stage.releasePointerCapture(swipe.pointerId);
    }
    swipeRef.current = null;
    setIsSwipePressing(false);
  }

  function onStagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (pageCount <= 1 || e.button !== 0 || isInteractivePointerTarget(e.target)) return;
    swipeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsSwipePressing(true);
    setKeyboardActive(false);
  }

  function onStagePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - swipe.startX;
    const deltaY = e.clientY - swipe.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY > SWIPE_VERTICAL_CANCEL && absY > absX) {
      endSwipeGesture(e.currentTarget);
      return;
    }

    if (absX < SWIPE_PAGE_THRESHOLD || absX < absY * 1.2) return;

    e.preventDefault();
    goToPage(deltaX < 0 ? pageIndex + 1 : pageIndex - 1);
    endSwipeGesture(e.currentTarget);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (pageCount > 1) {
        goToPage(pageIndex + 1);
      } else {
        moveActive(1);
      }
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (pageCount > 1) {
        goToPage(pageIndex - 1);
      } else {
        moveActive(-1);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(columns);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-columns);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const app = apps[activeIndex];
      if (app) openApp(app);
    }
  }

  return (
    <div
      className="launchpad"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="launchpad__surface" role="dialog" aria-label="启动台">
        <button type="button" className="launchpad__close" onClick={close} aria-label="关闭启动台">
          ×
        </button>
        <div className="launchpad__search">
          <img src="/icons/launchpad.png" alt="" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="搜索应用"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {apps.length === 0 ? (
          <div className="launchpad__empty">没有找到应用</div>
        ) : (
          <>
            <div
              className={`launchpad__stage ${isSwipePressing ? 'is-swipe-pressing' : ''}`}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={(e) => endSwipeGesture(e.currentTarget)}
              onPointerCancel={(e) => endSwipeGesture(e.currentTarget)}
            >
              {pageCount > 1 && (
                <>
                  <button
                    type="button"
                    className="launchpad__nav launchpad__nav--prev"
                    onClick={() => goToPage(pageIndex - 1)}
                    aria-label="上一页"
                  >
                    <ChevronLeft aria-hidden size={24} strokeWidth={2.6} />
                  </button>
                  <button
                    type="button"
                    className="launchpad__nav launchpad__nav--next"
                    onClick={() => goToPage(pageIndex + 1)}
                    aria-label="下一页"
                  >
                    <ChevronRight aria-hidden size={24} strokeWidth={2.6} />
                  </button>
                </>
              )}
              <AnimatePresence mode="wait" custom={pageDirection}>
                <motion.div
                  key={`${query}-${pageSize}-${pageIndex}`}
                  className="launchpad__page"
                  custom={{ direction: pageDirection, reduce: prefersReduced }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  variants={pageVariants}
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 420, damping: 38, mass: 0.82 }
                  }
                >
                  <div className="launchpad__grid">
                    {currentPage.map((app, pageItemIndex) => {
                      const index = pageStartIndex + pageItemIndex;
                      const isActive = keyboardActive && index === activeIndex;
                      const isRunning = runningApps.has(app.id);
                      return (
                        <button
                          type="button"
                          key={app.id}
                          className={`launchpad-app ${isActive ? 'is-keyboard-active' : ''}`}
                          onClick={() => openApp(app)}
                          aria-label={`打开${app.title}`}
                        >
                          <span className="launchpad-app__icon-wrap">
                            <img className="launchpad-app__icon" src={app.icon} alt="" />
                            <span
                              className={`launchpad-app__dot ${isRunning ? 'is-on' : ''}`}
                              aria-hidden
                            />
                          </span>
                          <span className="launchpad-app__title">{app.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {pageCount > 1 && (
              <nav className="launchpad__pager" aria-label="启动台分页">
                {pages.map((page, index) => (
                  <button
                    type="button"
                    key={`${page[0]?.id ?? 'page'}-${index}`}
                    className={`launchpad__dot ${index === pageIndex ? 'is-active' : ''}`}
                    onClick={() => goToPage(index)}
                    aria-label={`第 ${index + 1} 页`}
                    aria-current={index === pageIndex ? 'page' : undefined}
                  />
                ))}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function filterApps(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return DESKTOP_APP_LIST;

  return DESKTOP_APP_LIST.filter((app) => {
    const category = CATEGORY_LABEL[app.category].toLowerCase();
    return (
      app.title.toLowerCase().includes(trimmed) ||
      category.includes(trimmed) ||
      app.keywords.some((keyword) => keyword.toLowerCase().includes(trimmed))
    );
  });
}

function chunkApps(apps: DesktopApp[], pageSize: number) {
  const chunks: DesktopApp[][] = [];
  for (let index = 0; index < apps.length; index += pageSize) {
    chunks.push(apps.slice(index, index + pageSize));
  }
  return chunks;
}

interface LaunchpadSwipeState {
  pointerId: number;
  startX: number;
  startY: number;
}

function isInteractivePointerTarget(target: EventTarget) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button, input, textarea, select, a, [role="button"]'));
}

function useLaunchpadMetrics() {
  const [metrics, setMetrics] = useState(() => getLaunchpadMetrics());

  useEffect(() => {
    function syncMetrics() {
      setMetrics(getLaunchpadMetrics());
    }

    window.addEventListener('resize', syncMetrics);
    return () => window.removeEventListener('resize', syncMetrics);
  }, []);

  return metrics;
}

function getLaunchpadMetrics() {
  if (typeof window === 'undefined') return DEFAULT_METRICS;
  if (window.innerWidth <= 640) return { pageSize: 8, columns: 4 };
  if (window.innerWidth <= 900) return { pageSize: 12, columns: 4 };
  return DEFAULT_METRICS;
}

const pageVariants = {
  enter: ({ direction, reduce }: { direction: number; reduce: boolean }) =>
    reduce
      ? { opacity: 1, x: 0 }
      : {
          opacity: 0,
          filter: 'blur(5px)',
          x: direction >= 0 ? 86 : -86,
          scale: 0.985,
        },
  center: ({ reduce }: { direction: number; reduce: boolean }) =>
    reduce
      ? { opacity: 1, x: 0 }
      : {
          opacity: 1,
          filter: 'blur(0px)',
          x: 0,
          scale: 1,
        },
  exit: ({ direction, reduce }: { direction: number; reduce: boolean }) =>
    reduce
      ? { opacity: 1, x: 0 }
      : {
          opacity: 0,
          filter: 'blur(5px)',
          x: direction >= 0 ? -86 : 86,
          scale: 0.985,
        },
};
