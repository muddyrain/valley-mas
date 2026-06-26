import { useEffect, useMemo } from 'react';
import { type BrowserTab, useBrowserStore } from '../store/browserStore';
import { useResourceStore } from '../store/resourceStore';
import PlushLoading from '../ui/PlushLoading';
import { scheduleIdleWork } from '../utils/scheduleIdleWork';
import './DockAppWindows.css';
import { selectRenderableTabs } from './safari/iframeQuota';
import SafariEmbedFallback from './safari/SafariEmbedFallback';
import SafariHome from './safari/SafariHome';
import SafariTabBar from './safari/SafariTabBar';
import './safari/SafariWindow.css';

function readIframeMeta(iframe: HTMLIFrameElement): {
  title: string | null;
  favicon: string | null;
} {
  try {
    const doc = iframe.contentDocument;
    if (!doc) return { title: null, favicon: null };
    const title = doc.title?.trim() || null;
    const link = doc.querySelector<HTMLLinkElement>("link[rel*='icon']");
    const favicon = link?.href || null;
    return { title, favicon };
  } catch {
    return { title: null, favicon: null };
  }
}

export default function SafariWindow() {
  const loadResources = useResourceStore((s) => s.loadResources);

  const tabs = useBrowserStore((s) => s.tabs);
  const activeTabId = useBrowserStore((s) => s.activeTabId);
  const openUrl = useBrowserStore((s) => s.openUrl);
  const goHome = useBrowserStore((s) => s.goHome);
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const refresh = useBrowserStore((s) => s.refresh);
  const setAddressInput = useBrowserStore((s) => s.setAddressInput);
  const markTabLoaded = useBrowserStore((s) => s.markTabLoaded);
  const markTabEmbedLimited = useBrowserStore((s) => s.markTabEmbedLimited);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];
  const currentUrl = activeTab.currentUrl;
  const addressInput = activeTab.addressInput;
  const history = activeTab.history;
  const future = activeTab.future;
  const status = activeTab.status;

  const renderableTabs = useMemo<BrowserTab[]>(
    () => selectRenderableTabs(tabs, activeTab),
    [tabs, activeTab],
  );

  useEffect(() => {
    if (currentUrl) return;
    return scheduleIdleWork(() => void loadResources());
  }, [currentUrl, loadResources]);

  useEffect(() => {
    if (!currentUrl || status !== 'loading') return;
    const timer = window.setTimeout(() => markTabEmbedLimited(activeTabId), 2600);
    return () => window.clearTimeout(timer);
  }, [currentUrl, status, activeTabId, markTabEmbedLimited]);

  return (
    <div className="dock-app-window safari-window">
      <SafariTabBar />
      <form
        className="safari-browser__bar"
        onSubmit={(e) => {
          e.preventDefault();
          openUrl(addressInput);
        }}
      >
        <button
          type="button"
          className="safari-browser__nav"
          onClick={goBack}
          disabled={history.length === 0}
          aria-label="后退"
        >
          ‹
        </button>
        <button
          type="button"
          className="safari-browser__nav"
          onClick={goForward}
          disabled={future.length === 0}
          aria-label="前进"
        >
          ›
        </button>
        <button type="button" className="safari-browser__nav" onClick={goHome} aria-label="主页">
          ⌂
        </button>
        <button
          type="button"
          className="safari-browser__nav"
          onClick={refresh}
          disabled={!currentUrl}
          aria-label="刷新"
        >
          ↻
        </button>
        <input
          className="safari-browser__address"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-label="网页地址"
          data-safari-address-input
        />
        <button type="submit" className="safari-browser__go">
          前往
        </button>
      </form>

      {currentUrl ? (
        <section className="safari-browser__page" aria-label="网页">
          {renderableTabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <iframe
                key={`${tab.id}:${tab.currentUrl}:${tab.reloadKey}`}
                className="safari-browser__iframe"
                title={tab.title ?? tab.currentUrl ?? '网页'}
                src={tab.currentUrl ?? ''}
                sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                style={isActive ? undefined : { display: 'none' }}
                onLoad={(event) => {
                  const meta = readIframeMeta(event.currentTarget);
                  markTabLoaded(tab.id, meta);
                }}
              />
            );
          })}
          {status === 'loading' && (
            <div className="safari-browser__loading">
              <PlushLoading variant="inline" title="正在载入" />
            </div>
          )}
          {status === 'embed-limited' && currentUrl && (
            <SafariEmbedFallback url={currentUrl} title={activeTab.title} onRetry={refresh} />
          )}
        </section>
      ) : (
        <SafariHome />
      )}
    </div>
  );
}
