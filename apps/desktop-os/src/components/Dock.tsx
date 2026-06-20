import {
  type CSSProperties,
  type PointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { getDefaultWindowOptions } from '../apps/desktopApps';
import { type DockItemConfig, useDockStore } from '../store/dockStore';
import { useLaunchpadStore } from '../store/launchpadStore';
import { type AppId, useWindowStore } from '../store/windowStore';
import './Dock.css';

const BOUNCE_MS = 600;

interface DockMenuState {
  item: DockItemConfig;
  anchor: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

interface DockMenuPosition {
  left: number;
  top: number;
}

export default function Dock() {
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const windows = useWindowStore((s) => s.windows);
  const isLaunchpadOpen = useLaunchpadStore((s) => s.isOpen);
  const toggleLaunchpad = useLaunchpadStore((s) => s.toggle);
  const closeLaunchpad = useLaunchpadStore((s) => s.close);
  const items = useDockStore((s) => s.items);
  const iconSize = useDockStore((s) => s.iconSize);
  const spacing = useDockStore((s) => s.spacing);
  const magnification = useDockStore((s) => s.magnification);
  const autoHide = useDockStore((s) => s.autoHide);
  const pinItem = useDockStore((s) => s.pinItem);
  const removeItem = useDockStore((s) => s.removeItem);
  const runningApps = new Set<AppId>(windows.map((w) => w.appId));

  const [bouncingIds, setBouncingIds] = useState<Set<string>>(new Set());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [menu, setMenu] = useState<DockMenuState | null>(null);
  const [menuPosition, setMenuPosition] = useState<DockMenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const visibleItems = items.filter((item) => item.visible);

  useEffect(() => {
    return () => {
      for (const t of Object.values(timersRef.current)) clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!menu) return;
    function closeMenu() {
      setMenu(null);
    }
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeMenu);
    };
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    const margin = 8;
    const gap = 10;
    const rect = menuRef.current.getBoundingClientRect();
    const anchorCenter = (menu.anchor.left + menu.anchor.right) / 2;
    const nextLeft = clamp(
      anchorCenter - rect.width / 2,
      margin,
      window.innerWidth - rect.width - margin,
    );
    const preferredTop = menu.anchor.top - rect.height - gap;
    const fallbackTop = menu.anchor.bottom + gap;
    const nextTop = clamp(
      preferredTop >= margin ? preferredTop : fallbackTop,
      margin,
      window.innerHeight - rect.height - margin,
    );
    setMenuPosition({ left: nextLeft, top: nextTop });
  }, [menu]);

  function triggerBounce(id: string) {
    setBouncingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (timersRef.current[id]) clearTimeout(timersRef.current[id]);
    timersRef.current[id] = setTimeout(() => {
      setBouncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, BOUNCE_MS);
  }

  function openItem(item: DockItemConfig) {
    triggerBounce(item.id);
    if (item.action === 'launchpad') {
      toggleLaunchpad();
      return;
    }
    if (item.appId) {
      closeLaunchpad();
      restoreOrFocus(item.appId, getDefaultWindowOptions(item.appId));
    }
  }

  function openDockSettings() {
    closeLaunchpad();
    restoreOrFocus('settings', getDefaultWindowOptions('settings'));
  }

  function isItemRunning(item: DockItemConfig) {
    if (item.action === 'launchpad') return isLaunchpadOpen;
    return item.appId ? runningApps.has(item.appId) : false;
  }

  function getMenuOpenLabel(item: DockItemConfig) {
    if (item.action === 'launchpad') return isLaunchpadOpen ? '隐藏启动台' : '显示启动台';
    return isItemRunning(item) ? '显示' : '打开';
  }

  function updateHoveredIndex(e: PointerEvent<HTMLDivElement>) {
    const entries = itemRefs.current
      .map((node, index) => ({ node, index }))
      .filter((entry): entry is { node: HTMLLIElement; index: number } => Boolean(entry.node));
    if (entries.length === 0) return;

    let nearestIndex = entries[0].index;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const entry of entries) {
      const rect = entry.node.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const distance = Math.abs(e.clientX - centerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = entry.index;
      }
    }
    setHoveredIndex(nearestIndex);
  }

  return (
    <>
      <div
        className={`dock ${magnification ? 'is-magnified' : ''} ${autoHide ? 'is-autohide' : ''}`}
        onPointerMove={updateHoveredIndex}
        onPointerLeave={() => setHoveredIndex(null)}
        style={
          {
            '--dock-icon-size': `${iconSize}px`,
            '--dock-gap': `${spacing}px`,
          } as CSSProperties
        }
      >
        <div className="dock__hover-zone" aria-hidden />
        <ul className="dock__list">
          {visibleItems.map((item, index) => {
            const isRunning = isItemRunning(item);
            const isBouncing = bouncingIds.has(item.id);
            const hoverDistance =
              hoveredIndex === null ? Number.POSITIVE_INFINITY : Math.abs(index - hoveredIndex);
            const hoverClass =
              hoverDistance === 0
                ? 'is-hovered'
                : hoverDistance === 1
                  ? 'is-near'
                  : hoverDistance === 2
                    ? 'is-far'
                    : '';
            return (
              <li
                key={item.id}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                className={`dock__item ${hoverClass}`}
              >
                <button
                  type="button"
                  className={`dock__btn ${isBouncing ? 'is-bouncing' : ''}`}
                  onClick={() => openItem(item)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuPosition(null);
                    setMenu({
                      item,
                      anchor: {
                        left: rect.left,
                        right: rect.right,
                        top: rect.top,
                        bottom: rect.bottom,
                      },
                    });
                  }}
                >
                  <img className="dock__icon" src={item.icon} alt={item.label} />
                  <span className="dock__tooltip">{item.label}</span>
                </button>
                <span className={`dock__indicator ${isRunning ? 'is-on' : ''}`} aria-hidden />
              </li>
            );
          })}
        </ul>
      </div>

      {menu ? (
        <DockContextMenu
          item={menu.item}
          menuRef={menuRef}
          menuPosition={menuPosition}
          hasPrimaryMenuAction={Boolean(menu.item.appId || menu.item.action)}
          onOpen={() => {
            openItem(menu.item);
            setMenu(null);
          }}
          onPin={() => {
            pinItem(menu.item.id);
            setMenu(null);
          }}
          onRemove={() => {
            removeItem(menu.item.id);
            setMenu(null);
          }}
          onOpenSettings={() => {
            openDockSettings();
            setMenu(null);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          openLabel={getMenuOpenLabel(menu.item)}
        />
      ) : null}
    </>
  );
}

function DockContextMenu({
  item,
  menuRef,
  menuPosition,
  hasPrimaryMenuAction,
  openLabel,
  onOpen,
  onPin,
  onRemove,
  onOpenSettings,
  onPointerDown,
}: {
  item: DockItemConfig;
  menuRef: React.RefObject<HTMLDivElement | null>;
  menuPosition: DockMenuPosition | null;
  hasPrimaryMenuAction: boolean;
  openLabel: string;
  onOpen: () => void;
  onPin: () => void;
  onRemove: () => void;
  onOpenSettings: () => void;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
}) {
  const hasOptionActions = !item.pinned || !item.required;

  return (
    <div
      ref={menuRef}
      className="dock-menu"
      style={{
        left: menuPosition?.left ?? 0,
        top: menuPosition?.top ?? 0,
        visibility: menuPosition ? 'visible' : 'hidden',
      }}
      onPointerDown={onPointerDown}
    >
      {hasPrimaryMenuAction ? (
        <>
          <button
            type="button"
            className="dock-menu__item dock-menu__item--primary"
            onClick={onOpen}
          >
            {openLabel}
          </button>
          <div className="dock-menu__separator" role="presentation" />
        </>
      ) : null}
      {hasOptionActions ? (
        <>
          <div className="dock-menu__submenu-shell">
            <button type="button" className="dock-menu__item dock-menu__item--submenu-trigger">
              <span>选项</span>
              <span className="dock-menu__chevron" aria-hidden>
                ›
              </span>
            </button>
            <div className="dock-menu__submenu">
              {!item.pinned && (
                <button type="button" className="dock-menu__item" onClick={onPin}>
                  在 Dock 中保留
                </button>
              )}
              {!item.required && (
                <button type="button" className="dock-menu__item" onClick={onRemove}>
                  从 Dock 中移除
                </button>
              )}
            </div>
          </div>
          <div className="dock-menu__separator" role="presentation" />
        </>
      ) : null}
      <button type="button" className="dock-menu__item" onClick={onOpenSettings}>
        Dock 设置
      </button>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
