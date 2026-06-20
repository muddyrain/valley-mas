import { type MouseEvent, useEffect, useState } from 'react';
import { getDefaultWindowOptions, getDesktopApp } from '../apps/desktopApps';
import type { FinderPath } from '../finder/data';
import { useControlCenterStore } from '../store/controlCenterStore';
import { useFinderStore } from '../store/finderStore';
import { useLaunchpadStore } from '../store/launchpadStore';
import { useNotificationCenterStore } from '../store/notificationCenterStore';
import { useSpotlightStore } from '../store/spotlightStore';
import { useWindowStore } from '../store/windowStore';
import MusicMenuItem from './MusicMenuItem';
import './MenuBar.css';

type MenuKey = 'file' | 'edit' | 'view' | 'go' | 'window' | 'help';

type MenuEntry =
  | {
      type?: 'item';
      label: string;
      shortcut?: string;
      disabled?: boolean;
      action?: () => void;
    }
  | {
      type: 'separator';
    };

const MENU_LABELS: Record<MenuKey, string> = {
  file: '文件',
  edit: '编辑',
  view: '显示',
  go: '前往',
  window: '窗口',
  help: '帮助',
};

const MENU_KEYS = Object.keys(MENU_LABELS) as MenuKey[];

function formatClock(d: Date) {
  const week = ['日', '一', '二', '三', '四', '五', '六'];
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m}月${day}日 周${week[d.getDay()]} ${hh}:${mm}`;
}

export default function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  const [appleMenuOpen, setAppleMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const focused = useWindowStore((s) => s.windows.find((w) => w.id === s.focusedId));
  const openWindow = useWindowStore((s) => s.openWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const setFinderPath = useFinderStore((s) => s.setPath);
  const openSpotlight = useSpotlightStore((s) => s.open);
  const isLaunchpadOpen = useLaunchpadStore((s) => s.isOpen);
  const toggleLaunchpad = useLaunchpadStore((s) => s.toggle);
  const closeLaunchpad = useLaunchpadStore((s) => s.close);
  const toggleControlCenter = useControlCenterStore((s) => s.toggle);
  const closeControlCenter = useControlCenterStore((s) => s.close);
  const isOnline = useControlCenterStore((s) => s.isOnline);
  const bluetoothStatus = useControlCenterStore((s) => s.bluetoothStatus);
  const toggleNotificationCenter = useNotificationCenterStore((s) => s.toggle);
  const closeNotificationCenter = useNotificationCenterStore((s) => s.close);
  const unreadCount = useNotificationCenterStore((s) => s.unreadCount);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!appleMenuOpen && !activeMenu) return;
    function closeMenus() {
      setAppleMenuOpen(false);
      setActiveMenu(null);
    }
    window.addEventListener('pointerdown', closeMenus);
    window.addEventListener('keydown', closeMenus);
    return () => {
      window.removeEventListener('pointerdown', closeMenus);
      window.removeEventListener('keydown', closeMenus);
    };
  }, [appleMenuOpen, activeMenu]);

  function closeMenus() {
    setAppleMenuOpen(false);
    setActiveMenu(null);
  }

  function openAbout() {
    closeLaunchpad();
    restoreOrFocus('about', getDefaultWindowOptions('about'));
    closeMenus();
  }

  function handleControlCenter(e: MouseEvent) {
    e.stopPropagation();
    closeMenus();
    closeLaunchpad();
    closeNotificationCenter();
    toggleControlCenter();
  }

  function handleNotificationCenter(e: MouseEvent) {
    e.stopPropagation();
    closeMenus();
    closeLaunchpad();
    closeControlCenter();
    toggleNotificationCenter();
  }

  function handleLaunchpad(e: MouseEvent) {
    e.stopPropagation();
    closeMenus();
    closeControlCenter();
    closeNotificationCenter();
    toggleLaunchpad();
  }

  function handleSpotlight(e: MouseEvent) {
    e.stopPropagation();
    closeMenus();
    closeLaunchpad();
    openSpotlight();
  }

  function openApp(appId: Parameters<typeof getDefaultWindowOptions>[0]) {
    closeLaunchpad();
    restoreOrFocus(appId, getDefaultWindowOptions(appId));
    closeMenus();
  }

  function openNewAppWindow(appId: Parameters<typeof getDefaultWindowOptions>[0]) {
    closeLaunchpad();
    openWindow(appId, getDefaultWindowOptions(appId));
    closeMenus();
  }

  function goFinder(path: FinderPath) {
    closeLaunchpad();
    setFinderPath(path);
    restoreOrFocus('finder', getDefaultWindowOptions('finder'));
    closeMenus();
  }

  function handleMenuAction(entry: MenuEntry) {
    if (entry.type === 'separator' || entry.disabled || !entry.action) return;
    entry.action();
  }

  function toggleMenu(menu: MenuKey) {
    setAppleMenuOpen(false);
    setActiveMenu((current) => (current === menu ? null : menu));
  }

  const appName = focused ? getDesktopApp(focused.appId).title : getDesktopApp('finder').title;
  const displayAppName = isLaunchpadOpen ? '启动台' : appName;
  const hasFocusedWindow = Boolean(focused);
  const menuEntries: Record<MenuKey, MenuEntry[]> = {
    file: [
      { label: '新建 Finder 窗口', shortcut: '⌘N', action: () => openNewAppWindow('finder') },
      { label: '打开 Safari', action: () => openApp('safari') },
      { label: '打开下载', action: () => openApp('downloads') },
      { type: 'separator' },
      {
        label: '关闭窗口',
        shortcut: '⌘W',
        disabled: !focused,
        action: () => {
          if (focused) closeWindow(focused.id);
          closeMenus();
        },
      },
    ],
    edit: [
      { label: '撤销', shortcut: '⌘Z', disabled: true },
      { label: '重做', shortcut: '⇧⌘Z', disabled: true },
      { type: 'separator' },
      { label: '剪切', shortcut: '⌘X', disabled: true },
      { label: '复制', shortcut: '⌘C', disabled: true },
      { label: '粘贴', shortcut: '⌘V', disabled: true },
      { label: '全选', shortcut: '⌘A', disabled: true },
    ],
    view: [
      {
        label: '显示 Spotlight',
        shortcut: '⌘K',
        action: () => {
          closeLaunchpad();
          openSpotlight();
          closeMenus();
        },
      },
      {
        label: isLaunchpadOpen ? '隐藏启动台' : '显示启动台',
        action: () => {
          closeControlCenter();
          closeNotificationCenter();
          toggleLaunchpad();
          closeMenus();
        },
      },
      {
        label: '显示控制中心',
        action: () => {
          closeLaunchpad();
          closeNotificationCenter();
          toggleControlCenter();
          closeMenus();
        },
      },
      {
        label: '显示通知中心',
        action: () => {
          closeLaunchpad();
          closeControlCenter();
          toggleNotificationCenter();
          closeMenus();
        },
      },
    ],
    go: [
      { label: '全部资源', action: () => goFinder('all') },
      { label: '我的收藏', action: () => goFinder('favorites') },
      { label: '最近浏览', action: () => goFinder('recent') },
      { label: 'AI 工具', action: () => goFinder('ai') },
      { label: '设计资源', action: () => goFinder('design') },
      { label: '开发资源', action: () => goFinder('development') },
      { label: '灵感收藏', action: () => goFinder('inspiration') },
      { label: '下载资料', action: () => goFinder('downloads') },
    ],
    window: [
      {
        label: '最小化',
        shortcut: '⌘M',
        disabled: !focused,
        action: () => {
          if (focused) minimizeWindow(focused.id);
          closeMenus();
        },
      },
      {
        label: '前置当前窗口',
        disabled: !focused,
        action: () => {
          closeLaunchpad();
          if (focused) restoreOrFocus(focused.appId, getDefaultWindowOptions(focused.appId));
          closeMenus();
        },
      },
      { type: 'separator' },
      { label: '打开系统设置', action: () => openApp('settings') },
    ],
    help: [
      { label: '关于本机', action: openAbout },
      { label: '打开账户', action: () => openApp('account') },
      { label: '打开日历', action: () => openApp('calendar') },
    ],
  };

  return (
    <div className="menu-bar">
      <div className="menu-bar__left">
        <div className="menu-bar__apple">
          <button
            type="button"
            className={`menu-bar__logo ${appleMenuOpen ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(null);
              setAppleMenuOpen((open) => !open);
            }}
            aria-label="Apple 菜单"
            aria-expanded={appleMenuOpen}
          >
            🍎
          </button>
          {appleMenuOpen && (
            <div className="apple-menu" onPointerDown={(e) => e.stopPropagation()}>
              <button type="button" onClick={openAbout}>
                关于本机
              </button>
              <button
                type="button"
                onClick={() => {
                  closeLaunchpad();
                  restoreOrFocus('settings', getDefaultWindowOptions('settings'));
                  closeMenus();
                }}
              >
                系统设置
              </button>
            </div>
          )}
        </div>
        <span className="menu-bar__app" title={displayAppName}>
          {displayAppName}
        </span>
        {MENU_KEYS.map((menu) => (
          <div className="menu-bar__menu-wrap" key={menu}>
            <button
              type="button"
              className={`menu-bar__item ${activeMenu === menu ? 'is-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu(menu);
              }}
              onMouseEnter={() => {
                if (activeMenu) setActiveMenu(menu);
              }}
              aria-haspopup="menu"
              aria-expanded={activeMenu === menu}
            >
              {MENU_LABELS[menu]}
            </button>
            {activeMenu === menu && (
              <div className="menu-dropdown" role="menu" onPointerDown={(e) => e.stopPropagation()}>
                {menuEntries[menu].map((entry, index) =>
                  entry.type === 'separator' ? (
                    <div className="menu-dropdown__separator" key={`${menu}-separator-${index}`} />
                  ) : (
                    <button
                      type="button"
                      key={`${menu}-${entry.label}`}
                      className="menu-dropdown__item"
                      disabled={entry.disabled}
                      onClick={() => handleMenuAction(entry)}
                      role="menuitem"
                    >
                      <span>{entry.label}</span>
                      {entry.shortcut && <kbd>{entry.shortcut}</kbd>}
                    </button>
                  ),
                )}
                {!hasFocusedWindow && menu === 'window' && (
                  <div className="menu-dropdown__hint">没有打开的窗口</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="menu-bar__right">
        <MusicMenuItem />
        <button
          type="button"
          className={`menu-bar__btn menu-bar__btn--launchpad ${isLaunchpadOpen ? 'is-active' : ''}`}
          onClick={handleLaunchpad}
          title="启动台"
          aria-pressed={isLaunchpadOpen}
        >
          <img src="/icons/launchpad.png" alt="" />
        </button>
        <button
          type="button"
          className="menu-bar__btn"
          onClick={handleSpotlight}
          title="搜索（⌘K）"
        >
          🔍
        </button>
        <button
          type="button"
          className="menu-bar__btn menu-bar__btn--cc"
          onClick={handleControlCenter}
          title="控制中心"
        >
          <span className={isOnline ? '' : 'is-dim'}>📶</span>
          <span className={bluetoothStatus === 'unsupported' ? 'is-dim' : ''}>🔷</span>
          <span>🔋</span>
        </button>
        <button
          type="button"
          className="menu-bar__btn menu-bar__btn--clock"
          onClick={handleNotificationCenter}
          title="通知中心"
        >
          {formatClock(now)}
          {unreadCount > 0 && <span className="menu-bar__badge">{Math.min(unreadCount, 99)}</span>}
        </button>
      </div>
    </div>
  );
}
