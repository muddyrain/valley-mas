import { useCallback, useState } from 'react';
import { type BrowserTab, MAX_TABS, useBrowserStore } from '../../store/browserStore';
import PlushScrollbar from '../../ui/PlushScrollbar';
import './SafariWindow.css';

function tabLabel(tab: BrowserTab): string {
  if (tab.title?.trim()) return tab.title.trim();
  if (tab.currentUrl) {
    try {
      return new URL(tab.currentUrl).hostname.replace(/^www\./, '');
    } catch {
      return tab.currentUrl;
    }
  }
  return '起始页';
}

function tabInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return '·';
  const ch = trimmed[0];
  return ch.toUpperCase();
}

export default function SafariTabBar() {
  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const newTab = useBrowserStore((s) => s.newTab);
  const closeTab = useBrowserStore((s) => s.closeTab);
  const activateTab = useBrowserStore((s) => s.activateTab);
  const reorderTabs = useBrowserStore((s) => s.reorderTabs);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const atLimit = tabs.length >= MAX_TABS;

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, tabId: string) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // ignore unsupported envs
      }
      setDraggingId(tabId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingId) return;
      const root = event.currentTarget.parentElement;
      if (!root) return;
      const element = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>('[data-tab-id]');
      if (!element) return;
      const overId = element.dataset.tabId;
      if (!overId || overId === draggingId) return;
      reorderTabs(draggingId, overId);
    },
    [draggingId, reorderTabs],
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingId) return;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      setDraggingId(null);
    },
    [draggingId],
  );

  return (
    <div className="safari-tabbar">
      <PlushScrollbar
        className="safari-tabbar__scroll"
        options={{ overflow: { x: 'scroll', y: 'hidden' } }}
      >
        <div className="safari-tabbar__strip" role="tablist" aria-label="Safari 标签页">
          {tabs.map((tab) => {
            const label = tabLabel(tab);
            const isActive = tab.id === activeTabId;
            const isDragging = draggingId === tab.id;
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                tabIndex={0}
                data-tab-id={tab.id}
                className={`safari-tab${isActive ? ' safari-tab--active' : ''}${
                  isDragging ? ' safari-tab--dragging' : ''
                }`}
                onClick={() => activateTab(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    activateTab(tab.id);
                  }
                }}
                onPointerDown={(e) => handlePointerDown(e, tab.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
              >
                <span className="safari-tab__chip" aria-hidden>
                  {tab.favicon ? <img src={tab.favicon} alt="" /> : tabInitial(label)}
                </span>
                <span className="safari-tab__title">{label}</span>
                <button
                  type="button"
                  className="safari-tab__close"
                  aria-label={`关闭 ${label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      </PlushScrollbar>
      <button
        type="button"
        className="safari-tabbar__newbtn"
        onClick={() => newTab()}
        disabled={atLimit}
        aria-label="新建标签页"
        title={atLimit ? '标签页已达上限' : '新建标签页 (⌘T)'}
      >
        +
      </button>
    </div>
  );
}
