import { useEffect, useMemo } from 'react';
import { resourceToFinderItem } from '../finder/data';
import { useBrowserStore } from '../store/browserStore';
import { useResourceStore } from '../store/resourceStore';
import EmptyState from '../ui/EmptyState';
import PlushLoading from '../ui/PlushLoading';
import { scheduleIdleWork } from '../utils/scheduleIdleWork';
import './DockAppWindows.css';

export default function SafariWindow() {
  const resources = useResourceStore((s) => s.resources);
  const loading = useResourceStore((s) => s.loading);
  const error = useResourceStore((s) => s.error);
  const loadResources = useResourceStore((s) => s.loadResources);
  const shortcuts = useMemo(() => resources.slice(0, 8).map(resourceToFinderItem), [resources]);
  const currentUrl = useBrowserStore((s) => s.currentUrl);
  const addressInput = useBrowserStore((s) => s.addressInput);
  const history = useBrowserStore((s) => s.history);
  const future = useBrowserStore((s) => s.future);
  const reloadKey = useBrowserStore((s) => s.reloadKey);
  const status = useBrowserStore((s) => s.status);
  const openUrl = useBrowserStore((s) => s.openUrl);
  const goHome = useBrowserStore((s) => s.goHome);
  const goBack = useBrowserStore((s) => s.goBack);
  const goForward = useBrowserStore((s) => s.goForward);
  const refresh = useBrowserStore((s) => s.refresh);
  const setAddressInput = useBrowserStore((s) => s.setAddressInput);
  const markLoaded = useBrowserStore((s) => s.markLoaded);
  const markEmbedLimited = useBrowserStore((s) => s.markEmbedLimited);

  useEffect(() => {
    if (currentUrl) return;
    return scheduleIdleWork(() => void loadResources());
  }, [currentUrl, loadResources]);

  useEffect(() => {
    if (!currentUrl || status !== 'loading') return;
    const timer = window.setTimeout(markEmbedLimited, 2600);
    return () => window.clearTimeout(timer);
  }, [currentUrl, status, markEmbedLimited]);

  return (
    <div className="dock-app-window safari-window">
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
        />
        <button type="submit" className="safari-browser__go">
          前往
        </button>
      </form>

      {currentUrl ? (
        <section className="safari-browser__page" aria-label="网页">
          <iframe
            key={`${currentUrl}-${reloadKey}`}
            className="safari-browser__iframe"
            title={currentUrl}
            src={currentUrl}
            sandbox="allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
            onLoad={markLoaded}
          />
          {(status === 'loading' || status === 'embed-limited') && (
            <div className="safari-browser__fallback">
              <span>{status === 'loading' ? '正在载入' : '网页可能限制嵌入显示'}</span>
              <button
                type="button"
                className="dock-app-window__button"
                onClick={() => window.open(currentUrl, '_blank', 'noopener,noreferrer')}
              >
                新窗口打开
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="safari-browser__home" aria-label="Safari 主页">
          <div className="safari-browser__home-title">
            <div className="dock-app-window__eyebrow">Safari</div>
            <h2>起始页</h2>
          </div>
          <div className="safari-browser__shortcuts">
            {loading && (
              <PlushLoading
                className="safari-browser__empty"
                title="正在载入资源"
                description="请稍候"
                variant="panel"
              />
            )}
            {error && (
              <EmptyState
                className="safari-browser__empty"
                icon="!"
                title="资源加载失败"
                description={error}
                tone="danger"
              />
            )}
            {!loading && !error && shortcuts.length === 0 && (
              <EmptyState
                className="safari-browser__empty"
                icon="◇"
                title="暂无资源"
                description="稍后再试"
              />
            )}
            {shortcuts.map((item) => (
              <button
                type="button"
                key={item.id}
                className="safari-shortcut"
                onClick={() => openUrl(item.publicUrl ?? '')}
              >
                <img src={item.icon} alt="" aria-hidden />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
