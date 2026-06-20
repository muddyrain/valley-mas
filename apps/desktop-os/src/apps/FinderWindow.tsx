import {
  type PointerEvent as ReactPointerEvent,
  type UIEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type WheelEvent,
} from 'react';
import {
  FINDER_SECTIONS,
  type FinderItem,
  type FinderPath,
  filterResourcesForPath,
  getFinderItems,
  isServerResourcePath,
  PATH_LABEL,
  resourceToFinderItem,
} from '../finder/data';
import { useAuthStore } from '../store/authStore';
import { useBrowserStore } from '../store/browserStore';
import { type FinderViewMode, getFinderViewKey, useFinderStore } from '../store/finderStore';
import { useResourceStore } from '../store/resourceStore';
import { useWindowStore } from '../store/windowStore';
import EmptyState from '../ui/EmptyState';
import { getDefaultWindowOptions } from './desktopApps';
import './FinderWindow.css';

const VIEW_MODES: Array<{ id: FinderViewMode; label: string; icon: string }> = [
  { id: 'grid', label: '网格', icon: '▦' },
  { id: 'list', label: '列表', icon: '☰' },
  { id: 'gallery', label: '画廊', icon: '▣' },
];

interface FinderContextMenuState {
  item: FinderItem;
  x: number;
  y: number;
}

export default function FinderWindow() {
  const currentPath = useFinderStore((s) => s.currentPath);
  const selectedId = useFinderStore((s) => s.selectedId);
  const activeTagId = useFinderStore((s) => s.activeTagId);
  const viewMode = useFinderStore((s) => s.viewMode);
  const history = useFinderStore((s) => s.history);
  const future = useFinderStore((s) => s.future);
  const recentResourceIds = useFinderStore((s) => s.recentResourceIds);
  const downloadedResourceIds = useFinderStore((s) => s.downloadedResourceIds);
  const viewStates = useFinderStore((s) => s.viewStates);
  const setPath = useFinderStore((s) => s.setPath);
  const selectItem = useFinderStore((s) => s.selectItem);
  const setViewMode = useFinderStore((s) => s.setViewMode);
  const rememberViewState = useFinderStore((s) => s.rememberViewState);
  const markResourceViewed = useFinderStore((s) => s.markResourceViewed);
  const markResourceDownloaded = useFinderStore((s) => s.markResourceDownloaded);
  const goBack = useFinderStore((s) => s.goBack);
  const goForward = useFinderStore((s) => s.goForward);
  const goUp = useFinderStore((s) => s.goUp);
  const resources = useResourceStore((s) => s.resources);
  const tags = useResourceStore((s) => s.tags);
  const total = useResourceStore((s) => s.total);
  const keyword = useResourceStore((s) => s.keyword);
  const resourceTagId = useResourceStore((s) => s.tagId);
  const sort = useResourceStore((s) => s.sort);
  const loading = useResourceStore((s) => s.loading);
  const loadingMore = useResourceStore((s) => s.loadingMore);
  const hasMore = useResourceStore((s) => s.hasMore);
  const error = useResourceStore((s) => s.error);
  const loadResources = useResourceStore((s) => s.loadResources);
  const loadMoreResources = useResourceStore((s) => s.loadMoreResources);
  const setKeyword = useResourceStore((s) => s.setKeyword);
  const setTagId = useResourceStore((s) => s.setTagId);
  const setSort = useResourceStore((s) => s.setSort);
  const setActiveSmartView = useResourceStore((s) => s.setActiveSmartView);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const openUrl = useBrowserStore((s) => s.openUrl);
  const toggleFavorite = useResourceStore((s) => s.toggleFavorite);
  const download = useResourceStore((s) => s.download);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const [previewItem, setPreviewItem] = useState<FinderItem | null>(null);
  const [searchInput, setSearchInput] = useState(keyword);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sidebarScrolling, setSidebarScrolling] = useState(false);
  const [contextMenu, setContextMenu] = useState<FinderContextMenuState | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const browserRef = useRef<HTMLDivElement | null>(null);
  const sidebarScrollTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const restoringViewRef = useRef(false);

  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null;
  const isResourceBrowser = isServerResourcePath(currentPath);

  const items = useMemo(() => {
    if (!isResourceBrowser) return getFinderItems(currentPath);
    return filterResourcesForPath(currentPath, resources, {
      recentResourceIds,
      downloadedResourceIds,
    }).map(resourceToFinderItem);
  }, [currentPath, downloadedResourceIds, isResourceBrowser, recentResourceIds, resources]);

  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const previewableItems = useMemo(() => items.filter(isImagePreviewItem), [items]);
  const locationTitle = activeTag ? activeTag.name : PATH_LABEL[currentPath];
  const resultCount = isResourceBrowser ? `${items.length}/${total} 项` : `${items.length} 项`;
  const viewKey = getFinderViewKey(currentPath, activeTagId);
  const emptyDescription =
    currentPath === 'recent'
      ? '预览或打开资源后会出现在这里'
      : currentPath === 'downloads'
        ? '下载资源后会出现在这里'
        : keyword || activeTag
          ? '清除搜索或标签后再看'
          : '换个分类看看';
  const previewIndex = previewItem
    ? previewableItems.findIndex((item) => item.id === previewItem.id)
    : -1;
  const canPreviewPrevious = previewIndex > 0;
  const canPreviewNext = previewIndex >= 0 && previewIndex < previewableItems.length - 1;

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  useEffect(() => {
    setSearchInput(keyword);
  }, [keyword]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput.trim() !== keyword) void setKeyword(searchInput);
    }, 320);
    return () => window.clearTimeout(timer);
  }, [keyword, searchInput, setKeyword]);

  useEffect(() => {
    if (resourceTagId !== activeTagId) void setTagId(activeTagId);
  }, [activeTagId, resourceTagId, setTagId]);

  useEffect(() => {
    setActiveSmartView(currentPath);
  }, [currentPath, setActiveSmartView]);

  useEffect(() => {
    const saved = viewStates[viewKey];
    if (!saved) return;
    restoringViewRef.current = true;
    if (saved.viewMode && saved.viewMode !== viewMode) setViewMode(saved.viewMode);
    if (saved.sort && saved.sort !== sort) void setSort(saved.sort);
    if (saved.selectedId) selectItem(saved.selectedId);
    window.requestAnimationFrame(() => {
      if (browserRef.current && typeof saved.scrollTop === 'number') {
        browserRef.current.scrollTop = saved.scrollTop;
      }
      restoringViewRef.current = false;
    });
  }, [selectItem, setSort, setViewMode, sort, viewKey, viewMode, viewStates]);

  useEffect(() => {
    if (restoringViewRef.current) return;
    rememberViewState({ viewMode, sort, selectedId });
  }, [rememberViewState, selectedId, sort, viewMode]);

  useEffect(() => {
    if (!isResourceBrowser || loading || loadingMore || !hasMore) return;
    if (items.length >= 18) return;
    void loadMoreResources();
  }, [hasMore, isResourceBrowser, items.length, loadMoreResources, loading, loadingMore]);

  useEffect(() => {
    if (!previewItem) return;
    const activePreviewItem = previewItem;

    function stepKeyboardPreview(delta: number) {
      if (previewableItems.length === 0) return;
      const currentIndex = previewableItems.findIndex((item) => item.id === activePreviewItem.id);
      const nextIndex = clamp(
        (currentIndex === -1 ? 0 : currentIndex) + delta,
        0,
        previewableItems.length - 1,
      );
      const nextItem = previewableItems[nextIndex];
      if (!nextItem || nextItem.id === activePreviewItem.id) return;
      setPreviewItem(nextItem);
      selectItem(nextItem.id);
      if (nextItem.resourceId) markResourceViewed(nextItem.resourceId);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPreviewItem(null);
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepKeyboardPreview(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepKeyboardPreview(1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [markResourceViewed, previewItem, previewableItems, selectItem]);

  useEffect(() => {
    if (!contextMenu) return;

    function closeMenu() {
      setContextMenu(null);
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeMenu();
    }

    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!selected && items[0]) selectItem(items[0].id);
  }, [items, selected, selectItem]);

  useEffect(() => {
    if (!selectedId) return;
    itemRefs.current[selectedId]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (sidebarScrollTimerRef.current) window.clearTimeout(sidebarScrollTimerRef.current);
    };
  }, []);

  function openPath(path: FinderPath, tagId: string | null = null) {
    setPath(path, null, tagId);
  }

  function rememberResourceView(item: FinderItem) {
    if (item.resourceId) markResourceViewed(item.resourceId);
  }

  function openInSafari(url: string) {
    openUrl(url);
    restoreOrFocus('safari', getDefaultWindowOptions('safari'));
  }

  function showPreview(item: FinderItem) {
    rememberResourceView(item);
    selectItem(item.id);
    setPreviewItem(item);
  }

  function stepPreview(delta: number) {
    if (!previewItem || previewableItems.length === 0) return;
    const currentIndex = previewableItems.findIndex((item) => item.id === previewItem.id);
    const nextIndex = clamp(
      (currentIndex === -1 ? 0 : currentIndex) + delta,
      0,
      previewableItems.length - 1,
    );
    const nextItem = previewableItems[nextIndex];
    if (!nextItem || nextItem.id === previewItem.id) return;
    showPreview(nextItem);
  }

  function activateItem(item: FinderItem) {
    if (item.kind === 'folder' && item.targetPath) {
      openPath(item.targetPath);
      return;
    }
    selectItem(item.id);
    rememberResourceView(item);
    if (isImagePreviewItem(item)) {
      setPreviewItem(item);
      return;
    }
    if (item.publicUrl) openInSafari(item.publicUrl);
  }

  async function handleFavorite(item: FinderItem) {
    if (!item.resourceId) return;
    if (!isAuthenticated) {
      restoreOrFocus('account', getDefaultWindowOptions('account'));
      return;
    }
    await toggleFavorite(item.resourceId);
  }

  async function handleDownload(item: FinderItem) {
    if (!item.resourceId) return;
    const url = await download(item.resourceId);
    if (url) {
      markResourceDownloaded(item.resourceId);
      openInSafari(url);
    }
  }

  async function copyLink(item: FinderItem) {
    if (!item.publicUrl || !navigator.clipboard) return;
    await navigator.clipboard.writeText(item.publicUrl);
    setCopiedId(item.id);
    window.setTimeout(() => setCopiedId((current) => (current === item.id ? null : current)), 1400);
  }

  function clearSearch() {
    setSearchInput('');
    void setKeyword('');
  }

  function clearTag() {
    setPath('all', null, null);
  }

  function handleGridScroll(e: UIEvent<HTMLElement>) {
    rememberViewState({ scrollTop: e.currentTarget.scrollTop });
    if (!isResourceBrowser || loadingMore || loading || !hasMore) return;
    const target = e.currentTarget;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 160) void loadMoreResources();
  }

  function handleSidebarScroll() {
    setSidebarScrolling(true);
    if (sidebarScrollTimerRef.current) window.clearTimeout(sidebarScrollTimerRef.current);
    sidebarScrollTimerRef.current = window.setTimeout(() => {
      setSidebarScrolling(false);
      sidebarScrollTimerRef.current = null;
    }, 650);
  }

  function selectOffset(delta: number) {
    if (items.length === 0) return;
    const currentIndex = Math.max(
      0,
      selectedId ? items.findIndex((item) => item.id === selectedId) : 0,
    );
    const nextIndex = clamp(currentIndex + delta, 0, items.length - 1);
    selectItem(items[nextIndex].id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectOffset(e.key === 'ArrowRight' && viewMode === 'grid' ? 1 : 1);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectOffset(-1);
      return;
    }
    if (e.key === 'Enter' && selected) {
      e.preventDefault();
      activateItem(selected);
      return;
    }
    if (e.key === ' ' && selected) {
      e.preventDefault();
      if (isImagePreviewItem(selected)) showPreview(selected);
    }
  }

  function handleSortChange(nextSort: typeof sort) {
    rememberViewState({ sort: nextSort });
    void setSort(nextSort);
  }

  function openContextMenu(item: FinderItem, event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    selectItem(item.id);
    setContextMenu({
      item,
      x: clamp(event.clientX, 8, window.innerWidth - 244),
      y: clamp(event.clientY, 32, window.innerHeight - 260),
    });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  const groupedSections = {
    library: FINDER_SECTIONS.filter((section) => section.group === 'library'),
    smart: FINDER_SECTIONS.filter((section) => section.group === 'smart'),
  };

  return (
    <div className="finder-window">
      <aside
        className={`finder__sidebar ${sidebarScrolling ? 'is-scrolling' : ''}`}
        aria-label="Finder 位置"
        onScroll={handleSidebarScroll}
      >
        <FinderSidebarGroup
          title="资源库"
          sections={groupedSections.library}
          currentPath={currentPath}
          activeTagId={activeTagId}
          onOpenPath={openPath}
        />
        <FinderSidebarGroup
          title="智能分类"
          sections={groupedSections.smart}
          currentPath={currentPath}
          activeTagId={activeTagId}
          onOpenPath={openPath}
        />
        {tags.length > 0 && (
          <div className="finder__sidebar-group">
            <div className="finder__sidebar-title">标签</div>
            {tags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                className={`finder__side-item ${activeTagId === tag.id ? 'is-active' : ''}`}
                onClick={() => openPath('all', tag.id)}
                title={tag.description || tag.name}
              >
                <span className="finder__tag-dot" style={{ background: tag.color ?? undefined }} />
                <span>{tag.name}</span>
                {tag.resourceCount !== undefined && <small>{tag.resourceCount}</small>}
              </button>
            ))}
          </div>
        )}
      </aside>

      <main className="finder__main">
        <header className="finder__toolbar">
          <div className="finder__toolbar-top">
            <div className="finder__nav">
              <button
                type="button"
                onClick={goBack}
                disabled={history.length === 0}
                aria-label="返回"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={goForward}
                disabled={future.length === 0}
                aria-label="前进"
              >
                ›
              </button>
              <button
                type="button"
                onClick={goUp}
                disabled={currentPath === 'all' && !activeTagId}
                aria-label="上一级"
              >
                ⌂
              </button>
            </div>
            <div className="finder__title-block">
              <div className="finder__crumb">
                <button type="button" onClick={() => openPath('all')}>
                  资源库
                </button>
                <span>/</span>
                <span>{locationTitle}</span>
              </div>
              <h2>{locationTitle}</h2>
            </div>
            <span className="finder__count">{resultCount}</span>
          </div>

          <div className="finder__toolbar-bottom">
            <label className="finder__search">
              <span aria-hidden>⌕</span>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="搜索资源"
                spellCheck={false}
              />
              {searchInput && (
                <button type="button" onClick={clearSearch} aria-label="清除搜索">
                  ×
                </button>
              )}
            </label>

            <select
              className="finder__sort"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value === 'oldest' ? 'oldest' : 'newest')}
              aria-label="排序"
            >
              <option value="newest">最新</option>
              <option value="oldest">最旧</option>
            </select>

            <fieldset className="finder__view-switch">
              <legend className="finder__sr-only">视图</legend>
              {VIEW_MODES.map((mode) => (
                <button
                  type="button"
                  key={mode.id}
                  className={viewMode === mode.id ? 'is-active' : ''}
                  onClick={() => setViewMode(mode.id)}
                  title={mode.label}
                  aria-label={mode.label}
                >
                  {mode.icon}
                </button>
              ))}
            </fieldset>
          </div>

          {(keyword || activeTag) && (
            <div className="finder__filters">
              {keyword && (
                <button type="button" onClick={clearSearch}>
                  搜索：{keyword}
                  <span aria-hidden>×</span>
                </button>
              )}
              {activeTag && (
                <button type="button" onClick={clearTag}>
                  标签：{activeTag.name}
                  <span aria-hidden>×</span>
                </button>
              )}
            </div>
          )}
        </header>

        <div className="finder__content">
          <div
            ref={browserRef}
            className={`finder__browser finder__browser--${viewMode}`}
            aria-label={`${locationTitle}内容`}
            onScroll={handleGridScroll}
            onKeyDown={handleKeyDown}
            role="listbox"
            tabIndex={0}
          >
            {loading && (
              <EmptyState
                className="finder__empty-state"
                icon="⌁"
                title="正在载入资源"
                description="请稍候"
              />
            )}
            {error && (
              <EmptyState
                className="finder__empty-state"
                icon="!"
                title="资源加载失败"
                description="检查服务端连接后再试"
                tone="danger"
              />
            )}
            {!loading && !error && items.length === 0 && (
              <EmptyState
                className="finder__empty-state"
                icon="◇"
                title="没有匹配资源"
                description={emptyDescription}
              />
            )}
            {items.map((item) => (
              <FinderItemCard
                key={item.id}
                refNode={(node) => {
                  itemRefs.current[item.id] = node;
                }}
                item={item}
                viewMode={viewMode}
                selected={selected?.id === item.id}
                onSelect={() => selectItem(item.id)}
                onActivate={() => activateItem(item)}
                onPreview={() => showPreview(item)}
                onOpen={() => item.publicUrl && openInSafari(item.publicUrl)}
                onFavorite={() => void handleFavorite(item)}
                onContextMenu={(event) => openContextMenu(item, event)}
              />
            ))}
            {isResourceBrowser && !loading && !error && (
              <div className="finder__load-more">
                {loadingMore ? '正在载入更多' : hasMore ? '继续向下滚动' : '已显示全部'}
              </div>
            )}
          </div>

          <aside className="finder__detail" aria-label="内容详情">
            {selected ? (
              <FinderDetail
                item={selected}
                copied={copiedId === selected.id}
                onOpenPath={openPath}
                onPreview={() => showPreview(selected)}
                onOpen={() => selected.publicUrl && openInSafari(selected.publicUrl)}
                onFavorite={() => void handleFavorite(selected)}
                onDownload={() => void handleDownload(selected)}
                onCopy={() => void copyLink(selected)}
              />
            ) : (
              <EmptyState icon="◇" title="暂无内容" description="选择资源查看详情" />
            )}
          </aside>
        </div>

        <footer className="finder__status">
          <span>{items.length} 项</span>
          <span>Enter 打开</span>
          <span>Space 预览</span>
          <span>右键操作</span>
          {loadingMore && <span>载入更多</span>}
        </footer>
      </main>
      {previewItem && (
        <ImagePreview
          key={
            previewItem.previewUrl ??
            previewItem.previewImage ??
            previewItem.publicUrl ??
            previewItem.id
          }
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          onPrevious={() => stepPreview(-1)}
          onNext={() => stepPreview(1)}
          canPrevious={canPreviewPrevious}
          canNext={canPreviewNext}
        />
      )}
      {contextMenu && (
        <FinderContextMenu
          menu={contextMenu}
          onClose={closeContextMenu}
          onPreview={() => {
            showPreview(contextMenu.item);
            closeContextMenu();
          }}
          onOpen={() => {
            if (contextMenu.item.kind === 'folder' && contextMenu.item.targetPath) {
              openPath(contextMenu.item.targetPath);
            } else if (contextMenu.item.publicUrl) {
              rememberResourceView(contextMenu.item);
              openInSafari(contextMenu.item.publicUrl);
            }
            closeContextMenu();
          }}
          onFavorite={() => {
            void handleFavorite(contextMenu.item);
            closeContextMenu();
          }}
          onDownload={() => {
            void handleDownload(contextMenu.item);
            closeContextMenu();
          }}
          onCopy={() => {
            void copyLink(contextMenu.item);
            closeContextMenu();
          }}
          onDetails={() => {
            selectItem(contextMenu.item.id);
            closeContextMenu();
          }}
        />
      )}
    </div>
  );
}

interface FinderSidebarGroupProps {
  title: string;
  sections: typeof FINDER_SECTIONS;
  currentPath: FinderPath;
  activeTagId: string | null;
  onOpenPath: (path: FinderPath) => void;
}

function FinderSidebarGroup({
  title,
  sections,
  currentPath,
  activeTagId,
  onOpenPath,
}: FinderSidebarGroupProps) {
  return (
    <div className="finder__sidebar-group">
      <div className="finder__sidebar-title">{title}</div>
      {sections.map((section) => (
        <button
          type="button"
          key={section.path}
          className={`finder__side-item ${
            section.path === currentPath && !activeTagId ? 'is-active' : ''
          }`}
          onClick={() => onOpenPath(section.path)}
          title={section.description}
        >
          <img src={section.icon} alt="" aria-hidden />
          <span>{section.label}</span>
        </button>
      ))}
    </div>
  );
}

interface FinderItemCardProps {
  item: FinderItem;
  viewMode: FinderViewMode;
  selected: boolean;
  refNode: (node: HTMLElement | null) => void;
  onSelect: () => void;
  onActivate: () => void;
  onPreview: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onContextMenu: (event: React.MouseEvent<HTMLElement>) => void;
}

function FinderItemCard({
  item,
  viewMode,
  selected,
  refNode,
  onSelect,
  onActivate,
  onPreview,
  onOpen,
  onFavorite,
  onContextMenu,
}: FinderItemCardProps) {
  const canPreview = isImagePreviewItem(item);
  const canOpen = Boolean(item.publicUrl);
  const isResource = item.kind === 'resource' || item.kind === 'link';

  function stopAction(e: ReactPointerEvent<HTMLButtonElement>) {
    e.stopPropagation();
  }

  return (
    <div
      ref={refNode}
      className={`finder-card finder-card--${viewMode} ${selected ? 'is-selected' : ''}`}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onDoubleClick={onActivate}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
    >
      <div className="finder-card__media">
        <img
          className="finder-card__icon"
          src={item.previewImage ?? item.icon}
          alt=""
          aria-hidden
        />
        {isResource && (
          <div className="finder-card__badges">
            {item.extension && <span>{item.extension.toUpperCase()}</span>}
            {item.isFavorited && <span>已收藏</span>}
          </div>
        )}
      </div>
      <div className="finder-card__text">
        <span className="finder-card__title">{item.title}</span>
        <span className="finder-card__subtitle">{item.subtitle}</span>
        {viewMode !== 'grid' && (
          <span className="finder-card__meta">
            {item.status ?? kindLabel(item.kind)}
            {item.creatorName ? ` · ${item.creatorName}` : ''}
          </span>
        )}
      </div>
      <div className="finder-card__quick-actions">
        {canPreview && (
          <button type="button" tabIndex={-1} onPointerDown={stopAction} onClick={onPreview}>
            预览
          </button>
        )}
        {canOpen && (
          <button type="button" tabIndex={-1} onPointerDown={stopAction} onClick={onOpen}>
            打开
          </button>
        )}
        {item.resourceId && (
          <button type="button" tabIndex={-1} onPointerDown={stopAction} onClick={onFavorite}>
            {item.isFavorited ? '已收藏' : '收藏'}
          </button>
        )}
      </div>
    </div>
  );
}

interface FinderContextMenuProps {
  menu: FinderContextMenuState;
  onClose: () => void;
  onPreview: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onDownload: () => void;
  onCopy: () => void;
  onDetails: () => void;
}

function FinderContextMenu({
  menu,
  onClose,
  onPreview,
  onOpen,
  onFavorite,
  onDownload,
  onCopy,
  onDetails,
}: FinderContextMenuProps) {
  const item = menu.item;
  const canPreview = isImagePreviewItem(item);
  const canOpen = Boolean(item.publicUrl || item.targetPath);
  const canCopy = Boolean(item.publicUrl);

  return (
    <div
      className="finder-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="finder-context-menu__title">{item.title}</div>
      {canPreview && (
        <button type="button" role="menuitem" onClick={onPreview}>
          预览
        </button>
      )}
      {canOpen && (
        <button type="button" role="menuitem" onClick={onOpen}>
          {item.targetPath ? '打开' : '用 Safari 打开'}
        </button>
      )}
      {item.resourceId && (
        <>
          <button type="button" role="menuitem" onClick={onFavorite}>
            {item.isFavorited ? '取消收藏' : '收藏'}
          </button>
          <button type="button" role="menuitem" onClick={onDownload}>
            下载
          </button>
        </>
      )}
      {canCopy && (
        <button type="button" role="menuitem" onClick={onCopy}>
          复制链接
        </button>
      )}
      <span className="finder-context-menu__divider" />
      <button type="button" role="menuitem" onClick={onDetails}>
        查看详情
      </button>
      <button type="button" role="menuitem" onClick={onClose}>
        关闭菜单
      </button>
    </div>
  );
}

interface FinderDetailProps {
  item: FinderItem;
  copied: boolean;
  onOpenPath: (path: FinderPath) => void;
  onPreview: () => void;
  onOpen: () => void;
  onFavorite: () => void;
  onDownload: () => void;
  onCopy: () => void;
}

function FinderDetail({
  item,
  copied,
  onOpenPath,
  onPreview,
  onOpen,
  onFavorite,
  onDownload,
  onCopy,
}: FinderDetailProps) {
  const isResource = item.kind === 'resource' || item.kind === 'link';
  const canPreviewImage = isImagePreviewItem(item);
  const folderTargetPath = item.kind === 'folder' ? item.targetPath : undefined;
  const resourceUrl = item.publicUrl;

  return (
    <>
      <div className="finder__preview">
        <img
          className="finder__detail-icon"
          src={item.previewImage ?? item.icon}
          alt=""
          aria-hidden
        />
      </div>
      <div className="finder__detail-kind">{item.status ?? kindLabel(item.kind)}</div>
      <h3>{item.title}</h3>
      <p>{item.body}</p>

      <section className="finder__section finder__metadata">
        <span className="finder__section-title">信息</span>
        <dl>
          <div>
            <dt>类型</dt>
            <dd>
              {item.extension
                ? `${item.extension.toUpperCase()} · ${item.subtitle}`
                : item.subtitle}
            </dd>
          </div>
          {item.creatorName && (
            <div>
              <dt>作者</dt>
              <dd>{item.creatorName}</dd>
            </div>
          )}
          {item.size !== undefined && (
            <div>
              <dt>大小</dt>
              <dd>{formatBytes(item.size)}</dd>
            </div>
          )}
          {item.createdAt && (
            <div>
              <dt>时间</dt>
              <dd>{formatDate(item.createdAt)}</dd>
            </div>
          )}
          {(item.downloadCount !== undefined || item.favoriteCount !== undefined) && (
            <div>
              <dt>热度</dt>
              <dd>
                {item.downloadCount ?? 0} 下载 · {item.favoriteCount ?? 0} 收藏
              </dd>
            </div>
          )}
        </dl>
      </section>

      {isResource && item.highlights && (
        <section className="finder__section">
          <span className="finder__section-title">亮点</span>
          <ul className="finder__highlights">
            {item.highlights.map((highlight) => (
              <li key={highlight}>{highlight}</li>
            ))}
          </ul>
        </section>
      )}

      {!isResource && item.highlights && (
        <div className="finder__compact-list">
          {item.highlights.map((highlight) => (
            <span key={highlight}>{highlight}</span>
          ))}
        </div>
      )}

      {item.tags && (
        <div className="finder__tags">
          {item.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}

      {resourceUrl && !canPreviewImage && (
        <div className="finder__reference">
          <span>网址</span>
          <code>{resourceUrl}</code>
        </div>
      )}

      {item.reference && (
        <div className="finder__reference">
          <span>位置</span>
          <code>{item.reference}</code>
        </div>
      )}

      {item.actions && (
        <section className="finder__section">
          <span className="finder__section-title">入口</span>
          <div className="finder__actions">
            {item.actions.map((action) => (
              <div className="finder__action" key={`${action.label}-${action.detail}`}>
                <span>{action.label}</span>
                <code>{action.detail}</code>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="finder__button-row">
        {canPreviewImage ? (
          <button type="button" className="finder__open" onClick={onPreview}>
            预览
          </button>
        ) : resourceUrl ? (
          <button type="button" className="finder__open" onClick={onOpen}>
            用 Safari 打开
          </button>
        ) : null}
        {folderTargetPath && (
          <button
            type="button"
            className="finder__open"
            onClick={() => onOpenPath(folderTargetPath)}
          >
            打开
          </button>
        )}
        {item.resourceId && (
          <>
            <button
              type="button"
              className="finder__open finder__open--secondary"
              onClick={onFavorite}
            >
              {item.isFavorited ? '取消收藏' : '收藏'}
            </button>
            <button
              type="button"
              className="finder__open finder__open--secondary"
              onClick={onDownload}
            >
              下载
            </button>
          </>
        )}
        {resourceUrl && (
          <button type="button" className="finder__open finder__open--secondary" onClick={onCopy}>
            {copied ? '已复制' : '复制链接'}
          </button>
        )}
      </div>
    </>
  );
}

interface ImagePreviewProps {
  item: FinderItem;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
}

type PreviewPoint = {
  x: number;
  y: number;
};

type PreviewSize = {
  width: number;
  height: number;
};

type PreviewResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const PREVIEW_MIN_SCALE = 0.4;
const PREVIEW_MAX_SCALE = 4;
const PREVIEW_SCALE_STEP = 0.2;
const PREVIEW_MIN_WIDTH = 520;
const PREVIEW_MIN_HEIGHT = 360;
const PREVIEW_RESIZE_EDGES: PreviewResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

function ImagePreview({
  item,
  onClose,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
}: ImagePreviewProps) {
  const src = item.previewUrl ?? item.previewImage ?? item.publicUrl;
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [imageOffset, setImageOffset] = useState<PreviewPoint>({ x: 0, y: 0 });
  const [panelOffset, setPanelOffset] = useState<PreviewPoint>({ x: 0, y: 0 });
  const [panelSize, setPanelSize] = useState<PreviewSize>(() => getInitialPreviewSize());
  const [imageDragging, setImageDragging] = useState(false);
  const [panelDragging, setPanelDragging] = useState(false);
  const [panelResizing, setPanelResizing] = useState(false);
  const imageDragRef = useRef({
    pointerId: -1,
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
  });
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const panelDragRef = useRef({
    pointerId: -1,
    x: 0,
    y: 0,
    baseX: 0,
    baseY: 0,
  });
  const resizeRef = useRef<{
    edge: PreviewResizeEdge;
    pointerX: number;
    pointerY: number;
    size: PreviewSize;
    offset: PreviewPoint;
  } | null>(null);

  if (!src) return null;

  function zoomTo(nextScaleValue: number, anchor: PreviewPoint = { x: 0, y: 0 }) {
    const nextScale = clamp(nextScaleValue, PREVIEW_MIN_SCALE, PREVIEW_MAX_SCALE);
    if (nextScale === scale) return;

    const ratio = nextScale / scale;
    setScale(nextScale);
    setImageOffset({
      x: anchor.x - ratio * (anchor.x - imageOffset.x),
      y: anchor.y - ratio * (anchor.y - imageOffset.y),
    });
  }

  function zoomBy(delta: number) {
    zoomTo(scale + delta);
  }

  function resetTransform() {
    setScale(1);
    setRotate(0);
    setImageOffset({ x: 0, y: 0 });
  }

  function beginPanelDrag(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panelDragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      baseX: panelOffset.x,
      baseY: panelOffset.y,
    };
    setPanelDragging(true);
  }

  function movePanel(e: ReactPointerEvent<HTMLElement>) {
    const drag = panelDragRef.current;
    if (!panelDragging || drag.pointerId !== e.pointerId) return;
    setPanelOffset({
      x: drag.baseX + e.clientX - drag.x,
      y: drag.baseY + e.clientY - drag.y,
    });
  }

  function endPanelDrag(e: ReactPointerEvent<HTMLElement>) {
    if (panelDragRef.current.pointerId !== e.pointerId) return;
    releasePointer(e);
    panelDragRef.current.pointerId = -1;
    setPanelDragging(false);
  }

  function beginImageDrag(e: ReactPointerEvent<HTMLElement>) {
    if (e.button !== 0 || imageState !== 'loaded') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    imageDragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      baseX: imageOffset.x,
      baseY: imageOffset.y,
    };
    setImageDragging(true);
  }

  function moveImage(e: ReactPointerEvent<HTMLElement>) {
    const drag = imageDragRef.current;
    if (!imageDragging || drag.pointerId !== e.pointerId) return;
    setImageOffset({
      x: drag.baseX + e.clientX - drag.x,
      y: drag.baseY + e.clientY - drag.y,
    });
  }

  function endImageDrag(e: ReactPointerEvent<HTMLElement>) {
    if (imageDragRef.current.pointerId !== e.pointerId) return;
    releasePointer(e);
    imageDragRef.current.pointerId = -1;
    setImageDragging(false);
  }

  function handleWheel(e: WheelEvent<HTMLElement>) {
    if (imageState !== 'loaded') return;
    e.preventDefault();
    e.stopPropagation();
    const rect = previewStageRef.current?.getBoundingClientRect();
    const anchor = rect
      ? {
          x: e.clientX - (rect.left + rect.width / 2),
          y: e.clientY - (rect.top + rect.height / 2),
        }
      : { x: 0, y: 0 };
    const nextScale = scale * Math.exp(-e.deltaY * 0.0015);
    zoomTo(nextScale, anchor);
  }

  function beginPanelResize(edge: PreviewResizeEdge) {
    return (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      resizeRef.current = {
        edge,
        pointerX: e.clientX,
        pointerY: e.clientY,
        size: { ...panelSize },
        offset: { ...panelOffset },
      };
      setPanelResizing(true);

      const movePanelResize = (ev: PointerEvent) => {
        const start = resizeRef.current;
        if (!start) return;
        const dx = ev.clientX - start.pointerX;
        const dy = ev.clientY - start.pointerY;
        const maxWidth = Math.max(PREVIEW_MIN_WIDTH, window.innerWidth - 64);
        const maxHeight = Math.max(PREVIEW_MIN_HEIGHT, window.innerHeight - 64);
        let nextWidth = start.size.width;
        let nextHeight = start.size.height;

        if (start.edge.includes('e')) nextWidth = start.size.width + dx;
        if (start.edge.includes('w')) nextWidth = start.size.width - dx;
        if (start.edge.includes('s')) nextHeight = start.size.height + dy;
        if (start.edge.includes('n')) nextHeight = start.size.height - dy;

        nextWidth = clamp(nextWidth, PREVIEW_MIN_WIDTH, maxWidth);
        nextHeight = clamp(nextHeight, PREVIEW_MIN_HEIGHT, maxHeight);

        const widthDelta = nextWidth - start.size.width;
        const heightDelta = nextHeight - start.size.height;
        let nextX = start.offset.x;
        let nextY = start.offset.y;

        if (start.edge.includes('e')) nextX += widthDelta / 2;
        if (start.edge.includes('w')) nextX -= widthDelta / 2;
        if (start.edge.includes('s')) nextY += heightDelta / 2;
        if (start.edge.includes('n')) nextY -= heightDelta / 2;

        setPanelSize({ width: nextWidth, height: nextHeight });
        setPanelOffset({ x: nextX, y: nextY });
      };

      const endPanelResize = () => {
        resizeRef.current = null;
        setPanelResizing(false);
        window.removeEventListener('pointermove', movePanelResize);
        window.removeEventListener('pointerup', endPanelResize);
      };

      window.addEventListener('pointermove', movePanelResize);
      window.addEventListener('pointerup', endPanelResize);
    };
  }

  return (
    <div className="image-preview" role="dialog" aria-label="图片预览" onClick={onClose}>
      <div
        className={`image-preview__panel ${panelDragging ? 'is-dragging' : ''} ${
          panelResizing ? 'is-resizing' : ''
        }`}
        style={{
          width: panelSize.width,
          height: panelSize.height,
          transform: `translate3d(${panelOffset.x}px, ${panelOffset.y}px, 0)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {PREVIEW_RESIZE_EDGES.map((edge) => (
          <div
            key={edge}
            className={`image-preview__resize-handle image-preview__resize-handle--${edge}`}
            onPointerDown={beginPanelResize(edge)}
          />
        ))}
        <header
          className="image-preview__bar"
          onPointerDown={beginPanelDrag}
          onPointerMove={movePanel}
          onPointerUp={endPanelDrag}
          onPointerCancel={endPanelDrag}
        >
          <div>
            <strong>{item.title}</strong>
            <span>{item.subtitle}</span>
          </div>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="关闭预览"
          >
            ×
          </button>
        </header>
        <div
          ref={previewStageRef}
          className={`image-preview__stage is-${imageState} ${imageDragging ? 'is-dragging' : ''}`}
          onPointerDown={beginImageDrag}
          onPointerMove={moveImage}
          onPointerUp={endImageDrag}
          onPointerCancel={endImageDrag}
          onWheel={handleWheel}
          onDoubleClick={resetTransform}
        >
          {imageState !== 'loaded' && (
            <div className="image-preview__placeholder">
              <span>{imageState === 'error' ? '预览失败' : '载入中'}</span>
            </div>
          )}
          <img
            src={src}
            alt={item.title}
            draggable={false}
            style={{
              transform: `translate3d(${imageOffset.x}px, ${imageOffset.y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
            }}
            onLoad={() => setImageState('loaded')}
            onError={() => setImageState('error')}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
        <footer className="image-preview__tools" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canPrevious}
            aria-label="上一张"
            title="上一张"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            aria-label="下一张"
            title="下一张"
          >
            ›
          </button>
          <i aria-hidden />
          <button
            type="button"
            onClick={() => zoomBy(-PREVIEW_SCALE_STEP)}
            disabled={scale <= PREVIEW_MIN_SCALE}
            aria-label="缩小"
            title="缩小"
          >
            −
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => zoomBy(PREVIEW_SCALE_STEP)}
            disabled={scale >= PREVIEW_MAX_SCALE}
            aria-label="放大"
            title="放大"
          >
            +
          </button>
          <i aria-hidden />
          <button
            type="button"
            onClick={() => setRotate((current) => current - 90)}
            aria-label="向左旋转"
            title="向左旋转"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => setRotate((current) => current + 90)}
            aria-label="向右旋转"
            title="向右旋转"
          >
            ↻
          </button>
          <i aria-hidden />
          <button type="button" className="image-preview__reset" onClick={resetTransform}>
            重置
          </button>
        </footer>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getInitialPreviewSize(): PreviewSize {
  const width = typeof window === 'undefined' ? 860 : Math.min(860, window.innerWidth - 96);
  const height = typeof window === 'undefined' ? 620 : Math.min(620, window.innerHeight - 96);
  return {
    width: Math.max(PREVIEW_MIN_WIDTH, width),
    height: Math.max(PREVIEW_MIN_HEIGHT, height),
  };
}

function releasePointer(e: ReactPointerEvent<HTMLElement>) {
  try {
    e.currentTarget.releasePointerCapture(e.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function isImagePreviewItem(item: FinderItem) {
  return (
    item.mediaKind === 'image' && Boolean(item.previewUrl || item.previewImage || item.publicUrl)
  );
}

function kindLabel(kind: FinderItem['kind']) {
  switch (kind) {
    case 'folder':
      return '文件夹';
    case 'resource':
      return '资源';
    case 'note':
      return '笔记';
    case 'link':
      return '链接';
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}
