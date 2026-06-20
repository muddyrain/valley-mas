import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DESKTOP_APP_LIST,
  type DesktopApp,
  type DesktopAppCategory,
  getDefaultWindowOptions,
} from '../apps/desktopApps';
import { useLaunchpadStore } from '../store/launchpadStore';
import { useWindowStore } from '../store/windowStore';
import './Launchpad.css';

const CATEGORY_ORDER: DesktopAppCategory[] = ['system', 'content', 'tool', 'game'];
const CLOSE_ANIMATION_MS = 260;

const CATEGORY_LABEL: Record<DesktopAppCategory, string> = {
  system: '系统',
  content: '内容',
  tool: '工具',
  game: '小游戏',
};

export default function Launchpad() {
  const isOpen = useLaunchpadStore((s) => s.isOpen);
  const query = useLaunchpadStore((s) => s.query);
  const setQuery = useLaunchpadStore((s) => s.setQuery);
  const close = useLaunchpadStore((s) => s.close);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const windows = useWindowStore((s) => s.windows);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const runningApps = useMemo(() => new Set(windows.map((w) => w.appId)), [windows]);

  const apps = useMemo(() => filterApps(query), [query]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      return;
    }

    if (!shouldRender) return;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setIsClosing(false);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveIndex(0);
    setKeyboardActive(false);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  function openApp(app: DesktopApp) {
    restoreOrFocus(app.id, getDefaultWindowOptions(app.id));
    close();
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    setActiveIndex(0);
    setKeyboardActive(false);
  }

  function moveActive(delta: number) {
    if (apps.length === 0) return;
    setKeyboardActive(true);
    setActiveIndex((index) => (index + delta + apps.length) % apps.length);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      moveActive(1);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      moveActive(-1);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const app = apps[activeIndex];
      if (app) openApp(app);
    }
  }

  if (!shouldRender) return null;

  return (
    <div
      className={`launchpad ${isClosing ? 'is-closing' : 'is-open'}`}
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
          <div className="launchpad__groups">
            {CATEGORY_ORDER.map((category) => {
              const groupApps = apps.filter((app) => app.category === category);
              if (groupApps.length === 0) return null;
              return (
                <section className="launchpad__group" key={category}>
                  <div className="launchpad__group-title">
                    <span>{CATEGORY_LABEL[category]}</span>
                    <span>{groupApps.length}</span>
                  </div>
                  <div className="launchpad__grid">
                    {groupApps.map((app) => {
                      const index = apps.findIndex((item) => item.id === app.id);
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
                </section>
              );
            })}
          </div>
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
