import {
  type PointerEvent as ReactPointerEvent,
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
import {
  type FinderResourcePackage,
  type FinderSavedSearch,
  type FinderSavedTypeFilter,
  type FinderViewMode,
  getFinderViewKey,
  useFinderStore,
} from '../store/finderStore';
import { useNotesStore } from '../store/notesStore';
import { useResourceStore } from '../store/resourceStore';
import { useToolStore } from '../store/toolStore';
import { useWindowStore } from '../store/windowStore';
import EmptyState from '../ui/EmptyState';
import PlushImage from '../ui/PlushImage';
import PlushLoading from '../ui/PlushLoading';
import PlushLoadMore from '../ui/PlushLoadMore';
import PlushScrollbar from '../ui/PlushScrollbar';
import PlushSelect from '../ui/PlushSelect';
import { getDefaultWindowOptions } from './desktopApps';
import './FinderWindow.css';

const VIEW_MODES: Array<{ id: FinderViewMode; label: string; icon: string }> = [
  { id: 'grid', label: '网格', icon: '▦' },
  { id: 'list', label: '列表', icon: '☰' },
  { id: 'gallery', label: '画廊', icon: '▣' },
];

type FinderTypeFilter = FinderSavedTypeFilter;

const TYPE_FILTERS: Array<{ id: FinderTypeFilter; label: string }> = [
  { id: 'all', label: '全部类型' },
  { id: 'image', label: '图片' },
  { id: 'link', label: '网页' },
  { id: 'tool', label: '工具' },
  { id: 'downloadable', label: '可下载' },
];

interface FinderContextMenuState {
  item: FinderItem;
  x: number;
  y: number;
}

interface FinderOpenWithOption {
  id: string;
  label: string;
  detail: string;
  action: () => void;
}

export default function FinderWindow() {
  const currentPath = useFinderStore((s) => s.currentPath);
  const selectedId = useFinderStore((s) => s.selectedId);
  const selectedIds = useFinderStore((s) => s.selectedIds);
  const activeTagId = useFinderStore((s) => s.activeTagId);
  const viewMode = useFinderStore((s) => s.viewMode);
  const history = useFinderStore((s) => s.history);
  const future = useFinderStore((s) => s.future);
  const recentResourceIds = useFinderStore((s) => s.recentResourceIds);
  const downloadedResourceIds = useFinderStore((s) => s.downloadedResourceIds);
  const viewStates = useFinderStore((s) => s.viewStates);
  const resourcePackages = useFinderStore((s) => s.resourcePackages);
  const savedSearches = useFinderStore((s) => s.savedSearches);
  const setPath = useFinderStore((s) => s.setPath);
  const selectItem = useFinderStore((s) => s.selectItem);
  const toggleSelected = useFinderStore((s) => s.toggleSelected);
  const selectRange = useFinderStore((s) => s.selectRange);
  const clearSelection = useFinderStore((s) => s.clearSelection);
  const setViewMode = useFinderStore((s) => s.setViewMode);
  const rememberViewState = useFinderStore((s) => s.rememberViewState);
  const markResourceViewed = useFinderStore((s) => s.markResourceViewed);
  const markResourceDownloaded = useFinderStore((s) => s.markResourceDownloaded);
  const createResourcePackage = useFinderStore((s) => s.createResourcePackage);
  const addItemsToPackage = useFinderStore((s) => s.addItemsToPackage);
  const removeResourcePackage = useFinderStore((s) => s.removeResourcePackage);
  const saveSearch = useFinderStore((s) => s.saveSearch);
  const removeSavedSearch = useFinderStore((s) => s.removeSavedSearch);
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
  const refreshResources = useResourceStore((s) => s.refreshResources);
  const setKeyword = useResourceStore((s) => s.setKeyword);
  const setTagId = useResourceStore((s) => s.setTagId);
  const setSort = useResourceStore((s) => s.setSort);
  const setActiveSmartView = useResourceStore((s) => s.setActiveSmartView);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const openUrl = useBrowserStore((s) => s.openUrl);
  const toggleFavorite = useResourceStore((s) => s.toggleFavorite);
  const download = useResourceStore((s) => s.download);
  const createNote = useNotesStore((s) => s.createNote);
  const setTextLabDraft = useToolStore((s) => s.setTextLabDraft);
  const setDevToolsTab = useToolStore((s) => s.setDevToolsTab);
  const setDevJsonDraft = useToolStore((s) => s.setDevJsonDraft);
  const setDevEncodingDraft = useToolStore((s) => s.setDevEncodingDraft);
  const setDevCsvDraft = useToolStore((s) => s.setDevCsvDraft);
  const setDailyToolsTab = useToolStore((s) => s.setDailyToolsTab);
  const restoreOrFocus = useWindowStore((s) => s.restoreOrFocus);
  const [previewItem, setPreviewItem] = useState<FinderItem | null>(null);
  const [searchInput, setSearchInput] = useState(keyword);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FinderContextMenuState | null>(null);
  const [imageRetryKey, setImageRetryKey] = useState(0);
  const [activeTypeFilter, setActiveTypeFilter] = useState<FinderTypeFilter>('all');
  const [activePackageId, setActivePackageId] = useState<string | null>(null);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const browserRef = useRef<HTMLElement | null>(null);
  const scrollMemoryFrameRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);
  const restoringViewRef = useRef(false);
  const restoredViewKeyRef = useRef<string | null>(null);

  const activeTag = tags.find((tag) => tag.id === activeTagId) ?? null;
  const isResourceBrowser = isServerResourcePath(currentPath);
  const activePackage = resourcePackages.find((item) => item.id === activePackageId) ?? null;
  const activeSavedSearch = savedSearches.find((item) => item.id === activeSavedSearchId) ?? null;

  const pathItems = useMemo(() => {
    if (activePackage) {
      const resourceById = new Map(resources.map((resource) => [resource.id, resource]));
      return activePackage.resourceIds
        .flatMap((id) => {
          const resource = resourceById.get(id);
          return resource ? [resourceToFinderItem(resource)] : [];
        })
        .filter(Boolean);
    }
    if (!isResourceBrowser) return getFinderItems(currentPath);
    return filterResourcesForPath(currentPath, resources, {
      recentResourceIds,
      downloadedResourceIds,
    }).map(resourceToFinderItem);
  }, [
    activePackage,
    currentPath,
    downloadedResourceIds,
    isResourceBrowser,
    recentResourceIds,
    resources,
  ]);

  const items = useMemo(
    () => pathItems.filter((item) => matchesTypeFilter(item, activeTypeFilter)),
    [activeTypeFilter, pathItems],
  );

  const itemIds = useMemo(() => items.map((item) => item.id), [items]);
  const itemIdSet = useMemo(() => new Set(itemIds), [itemIds]);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const detailItem = selected ?? items[0] ?? null;
  const visibleSelectedIds = selectedIds.filter((id) => itemIdSet.has(id));
  const selectedItems = items.filter((item) => visibleSelectedIds.includes(item.id));
  const hasBatchSelection = selectedItems.length > 1;
  const previewableItems = useMemo(() => items.filter(isImagePreviewItem), [items]);
  const locationTitle =
    activePackage?.name ?? activeSavedSearch?.name ?? activeTag?.name ?? PATH_LABEL[currentPath];
  const resultCount = activePackage
    ? `${items.length}/${activePackage.resourceIds.length} 项`
    : activeTypeFilter === 'all'
      ? isResourceBrowser
        ? `${items.length}/${total} 项`
        : `${items.length} 项`
      : `${items.length}/${pathItems.length} 项`;
  const activeTypeLabel = TYPE_FILTERS.find((filter) => filter.id === activeTypeFilter)?.label;
  const activeFiltersLabel = buildSavedSearchName({
    keyword,
    tagName: activeTag?.name ?? null,
    typeLabel: activeTypeFilter === 'all' ? null : (activeTypeLabel ?? null),
  });
  const canSaveSearch = Boolean(keyword.trim() || activeTagId || activeTypeFilter !== 'all');
  const packageableItems =
    selectedItems.length > 0 ? selectedItems : detailItem ? [detailItem] : [];
  const packageableResourceIds = packageableItems.flatMap((item) =>
    item.resourceId ? [item.resourceId] : [],
  );
  const canCreatePackage = packageableResourceIds.length > 0;
  const viewKey = getFinderViewKey(currentPath, activeTagId);
  const emptyDescription =
    currentPath === 'recent'
      ? '预览或打开资源后会出现在这里'
      : currentPath === 'downloads'
        ? '下载资源后会出现在这里'
        : activePackage
          ? '这个资源包还没有可显示内容'
          : keyword || activeTag || activeTypeFilter !== 'all'
            ? '清除筛选后再看'
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
    if (restoredViewKeyRef.current === viewKey) return;
    restoredViewKeyRef.current = viewKey;
    const saved = viewStates[viewKey];
    if (!saved) {
      restoringViewRef.current = false;
      return;
    }
    restoringViewRef.current = true;
    if (saved.viewMode && saved.viewMode !== viewMode) setViewMode(saved.viewMode);
    if (saved.sort && saved.sort !== sort) void setSort(saved.sort);
    if (saved.selectedId) selectItem(saved.selectedId);
    window.requestAnimationFrame(() => {
      if (restoredViewKeyRef.current !== viewKey) {
        restoringViewRef.current = false;
        return;
      }
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
    if (items.length === 0) {
      if (selectedId || visibleSelectedIds.length > 0) clearSelection();
      return;
    }
    if (!selectedId || !itemIdSet.has(selectedId)) selectItem(items[0].id);
  }, [clearSelection, itemIdSet, items, selectItem, selectedId, visibleSelectedIds.length]);

  useEffect(() => {
    if (!selectedId) return;
    itemRefs.current[selectedId]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  useEffect(() => {
    return () => {
      if (scrollMemoryFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollMemoryFrameRef.current);
      }
    };
  }, []);

  function openPath(path: FinderPath, tagId: string | null = null) {
    setActivePackageId(null);
    setActiveSavedSearchId(null);
    setPath(path, null, tagId);
  }

  function openPackage(resourcePackage: FinderResourcePackage) {
    setActivePackageId(resourcePackage.id);
    setActiveSavedSearchId(null);
    setPath('all', null, null);
  }

  function openSavedSearch(savedSearch: FinderSavedSearch) {
    setActivePackageId(null);
    setActiveSavedSearchId(savedSearch.id);
    setActiveTypeFilter(savedSearch.typeFilter);
    setSearchInput(savedSearch.keyword);
    setPath('all', null, savedSearch.tagId);
    if (keyword !== savedSearch.keyword) void setKeyword(savedSearch.keyword);
    if (sort !== savedSearch.sort) void setSort(savedSearch.sort);
  }

  function saveCurrentSearch() {
    if (!canSaveSearch) return;
    saveSearch({
      name: activeFiltersLabel,
      keyword,
      tagId: activeTagId,
      sort,
      typeFilter: activeTypeFilter,
    });
  }

  function saveResourcePackage() {
    if (packageableResourceIds.length === 0) return;
    if (activePackage) {
      addItemsToPackage(activePackage.id, packageableResourceIds);
      return;
    }
    createResourcePackage(makeResourcePackageName(packageableItems), packageableResourceIds);
  }

  function clearPackage() {
    setActivePackageId(null);
  }

  function clearSavedSearch() {
    setActiveSavedSearchId(null);
  }

  function deleteResourcePackage(
    event: React.MouseEvent<HTMLButtonElement>,
    resourcePackageId: string,
  ) {
    event.stopPropagation();
    removeResourcePackage(resourcePackageId);
    if (activePackageId === resourcePackageId) {
      setActivePackageId(null);
      setPath('all', null, null);
    }
  }

  function deleteSavedSearch(event: React.MouseEvent<HTMLButtonElement>, savedSearchId: string) {
    event.stopPropagation();
    removeSavedSearch(savedSearchId);
    if (activeSavedSearchId === savedSearchId) {
      setActiveSavedSearchId(null);
    }
  }

  function rememberResourceView(item: FinderItem) {
    if (item.resourceId) markResourceViewed(item.resourceId);
  }

  function openInSafari(url: string) {
    openUrl(url);
    restoreOrFocus('safari', getDefaultWindowOptions('safari'));
  }

  function openItemInSafari(item: FinderItem) {
    if (!item.publicUrl) return;
    rememberResourceView(item);
    openInSafari(item.publicUrl);
  }

  async function openItemInNotes(item: FinderItem) {
    if (!token) {
      restoreOrFocus('account', getDefaultWindowOptions('account'));
      return;
    }
    const note = await createNote(token, {
      title: `资源：${item.title}`,
      content: formatResourceNote(item),
    });
    if (note) restoreOrFocus('notes', getDefaultWindowOptions('notes'));
  }

  async function openItemInTextLab(item: FinderItem) {
    setTextLabDraft(formatResourceText(item));
    await navigator.clipboard?.writeText(formatResourceText(item));
    restoreOrFocus('textLab', getDefaultWindowOptions('textLab'));
  }

  function openItemInDevTools(item: FinderItem) {
    const draft = item.publicUrl ?? formatResourceText(item);
    if (item.extension?.toLowerCase() === 'csv') {
      setDevToolsTab('csv');
      setDevCsvDraft(draft);
    } else if (item.extension?.toLowerCase() === 'json') {
      setDevToolsTab('json');
      setDevJsonDraft(draft);
    } else {
      setDevToolsTab('encoding');
      setDevEncodingDraft(draft);
    }
    restoreOrFocus('devTools', getDefaultWindowOptions('devTools'));
  }

  function openItemInDailyImageTools() {
    setDailyToolsTab('image');
    restoreOrFocus('dailyTools', getDefaultWindowOptions('dailyTools'));
  }

  function openItemInMusic() {
    restoreOrFocus('music', getDefaultWindowOptions('music'));
  }

  function getOpenWithOptions(item: FinderItem): FinderOpenWithOption[] {
    const options: FinderOpenWithOption[] = [];
    if (item.publicUrl) {
      options.push({
        id: 'safari',
        label: 'Safari',
        detail: '打开网页',
        action: () => openItemInSafari(item),
      });
    }
    if (isImagePreviewItem(item)) {
      options.push({
        id: 'daily-image',
        label: '图片工具',
        detail: '处理图片',
        action: openItemInDailyImageTools,
      });
    }
    if (isDevToolCandidate(item)) {
      options.push({
        id: 'dev-tools',
        label: '开发工具箱',
        detail: '解析数据',
        action: () => openItemInDevTools(item),
      });
    }
    if (isAudioItem(item)) {
      options.push({
        id: 'music',
        label: '音乐',
        detail: '打开播放器',
        action: openItemInMusic,
      });
    }
    if (item.kind === 'resource' || item.kind === 'link') {
      options.push(
        {
          id: 'notes',
          label: '便签',
          detail: '保存摘要',
          action: () => void openItemInNotes(item),
        },
        {
          id: 'text-lab',
          label: '文本工坊',
          detail: '处理文本',
          action: () => void openItemInTextLab(item),
        },
      );
    }
    return options;
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
    if (item.publicUrl) openItemInSafari(item);
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

  async function copyBatchLinks() {
    if (!navigator.clipboard) return;
    const links = selectedItems.flatMap((item) => (item.publicUrl ? [item.publicUrl] : []));
    if (links.length === 0) return;
    await navigator.clipboard.writeText(links.join('\n'));
    setCopiedId('batch');
    window.setTimeout(() => setCopiedId((current) => (current === 'batch' ? null : current)), 1400);
  }

  async function favoriteBatch() {
    const itemsToFavorite = selectedItems.filter((item) => item.resourceId && !item.isFavorited);
    if (itemsToFavorite.length === 0) return;
    if (!isAuthenticated) {
      restoreOrFocus('account', getDefaultWindowOptions('account'));
      return;
    }
    for (const item of itemsToFavorite) {
      if (item.resourceId) await toggleFavorite(item.resourceId);
    }
  }

  async function downloadBatch() {
    const downloadableItems = selectedItems.filter((item) => item.resourceId);
    const urls: string[] = [];
    for (const item of downloadableItems) {
      if (!item.resourceId) continue;
      const url = await download(item.resourceId);
      if (!url) continue;
      markResourceDownloaded(item.resourceId);
      urls.push(url);
    }
    if (urls[0]) openInSafari(urls[0]);
  }

  function clearSearch() {
    setActiveSavedSearchId(null);
    setSearchInput('');
    void setKeyword('');
  }

  function clearTypeFilter() {
    setActiveSavedSearchId(null);
    setActiveTypeFilter('all');
  }

  function clearTag() {
    setActiveSavedSearchId(null);
    setPath('all', null, null);
  }

  function handleGridScroll(event: Event) {
    const target = event.target as HTMLElement;
    rememberScrollTop(target.scrollTop);
    if (!isResourceBrowser || loadingMore || loading || !hasMore) return;
    const remaining = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (remaining < 160) void loadMoreResources();
  }

  function rememberScrollTop(scrollTop: number) {
    pendingScrollTopRef.current = scrollTop;
    if (scrollMemoryFrameRef.current !== null) return;
    scrollMemoryFrameRef.current = window.requestAnimationFrame(() => {
      scrollMemoryFrameRef.current = null;
      rememberViewState({ scrollTop: pendingScrollTopRef.current });
    });
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

  function selectCard(item: FinderItem, event: React.MouseEvent<HTMLElement>) {
    if (event.shiftKey) {
      selectRange(item.id, itemIds);
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      toggleSelected(item.id, 'toggle');
      return;
    }
    toggleSelected(item.id, 'replace');
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

  async function handleRefresh() {
    setImageRetryKey(Date.now());
    if (!isResourceBrowser) return;
    await refreshResources();
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
      <PlushScrollbar as="aside" className="finder__sidebar" aria-label="Finder 位置">
        <FinderSidebarGroup
          title="资源库"
          sections={groupedSections.library}
          currentPath={currentPath}
          activeTagId={activeTagId}
          suppressActive={Boolean(activePackage || activeSavedSearch)}
          onOpenPath={openPath}
        />
        <FinderSidebarGroup
          title="智能分类"
          sections={groupedSections.smart}
          currentPath={currentPath}
          activeTagId={activeTagId}
          suppressActive={Boolean(activePackage || activeSavedSearch)}
          onOpenPath={openPath}
        />
        {resourcePackages.length > 0 && (
          <div className="finder__sidebar-group">
            <div className="finder__sidebar-title">资源包</div>
            {resourcePackages.map((resourcePackage) => (
              <div
                key={resourcePackage.id}
                className={`finder__side-row ${
                  activePackageId === resourcePackage.id ? 'is-active' : ''
                }`}
              >
                <button
                  type="button"
                  className="finder__side-item"
                  onClick={() => openPackage(resourcePackage)}
                  title={resourcePackage.name}
                >
                  <span className="finder__package-dot" aria-hidden />
                  <span>{resourcePackage.name}</span>
                  <small>{resourcePackage.resourceIds.length}</small>
                </button>
                <button
                  type="button"
                  className="finder__side-delete"
                  aria-label={`删除资源包：${resourcePackage.name}`}
                  title="删除资源包"
                  onClick={(event) => deleteResourcePackage(event, resourcePackage.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {savedSearches.length > 0 && (
          <div className="finder__sidebar-group">
            <div className="finder__sidebar-title">保存搜索</div>
            {savedSearches.map((savedSearch) => (
              <div
                key={savedSearch.id}
                className={`finder__side-row ${
                  activeSavedSearchId === savedSearch.id ? 'is-active' : ''
                }`}
              >
                <button
                  type="button"
                  className="finder__side-item"
                  onClick={() => openSavedSearch(savedSearch)}
                  title={savedSearch.name}
                >
                  <span className="finder__search-dot" aria-hidden />
                  <span>{savedSearch.name}</span>
                </button>
                <button
                  type="button"
                  className="finder__side-delete"
                  aria-label={`删除保存搜索：${savedSearch.name}`}
                  title="删除保存搜索"
                  onClick={(event) => deleteSavedSearch(event, savedSearch.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
      </PlushScrollbar>

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

            <PlushSelect
              className="finder__type-filter"
              value={activeTypeFilter}
              onChange={setActiveTypeFilter}
              ariaLabel="资源类型"
              options={TYPE_FILTERS.map((filter) => ({ value: filter.id, label: filter.label }))}
            />

            <PlushSelect
              className="finder__sort"
              value={sort}
              onChange={(value) => handleSortChange(value === 'oldest' ? 'oldest' : 'newest')}
              ariaLabel="排序"
              options={[
                { value: 'newest', label: '最新' },
                { value: 'oldest', label: '最旧' },
              ]}
            />

            <button
              type="button"
              className="finder__refresh"
              onClick={() => void handleRefresh()}
              disabled={loading || loadingMore}
              title="刷新资源"
              aria-label="刷新资源"
            >
              ↻
            </button>

            <div className="finder__collection-actions">
              <button type="button" onClick={saveCurrentSearch} disabled={!canSaveSearch}>
                保存搜索
              </button>
              <button type="button" onClick={saveResourcePackage} disabled={!canCreatePackage}>
                {activePackage ? '加入资源包' : '新建资源包'}
              </button>
            </div>

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

          {(keyword ||
            activeTag ||
            activeTypeFilter !== 'all' ||
            activePackage ||
            activeSavedSearch) && (
            <div className="finder__filters">
              {activePackage && (
                <button type="button" onClick={clearPackage}>
                  资源包：{activePackage.name}
                  <span aria-hidden>×</span>
                </button>
              )}
              {activeSavedSearch && (
                <button type="button" onClick={clearSavedSearch}>
                  保存搜索：{activeSavedSearch.name}
                  <span aria-hidden>×</span>
                </button>
              )}
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
              {activeTypeFilter !== 'all' && activeTypeLabel && (
                <button type="button" onClick={clearTypeFilter}>
                  类型：{activeTypeLabel}
                  <span aria-hidden>×</span>
                </button>
              )}
            </div>
          )}
        </header>

        <div className="finder__content">
          <PlushScrollbar
            viewportRef={(node) => {
              browserRef.current = node;
            }}
            className={`finder__browser finder__browser--${viewMode}`}
            aria-label={`${locationTitle}内容`}
            onScroll={handleGridScroll}
            onKeyDown={handleKeyDown}
            role="listbox"
            tabIndex={0}
          >
            {loading && (
              <PlushLoading
                className="finder__empty-state"
                title="正在载入资源"
                description="请稍候"
                variant="panel"
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
                selected={visibleSelectedIds.includes(item.id)}
                imageRetryKey={imageRetryKey}
                onSelect={(event) => selectCard(item, event)}
                onActivate={() => activateItem(item)}
                onPreview={() => showPreview(item)}
                onOpen={() => openItemInSafari(item)}
                onFavorite={() => void handleFavorite(item)}
                onContextMenu={(event) => openContextMenu(item, event)}
              />
            ))}
            {isResourceBrowser && !loading && !error && (
              <PlushLoadMore
                className="finder__load-more"
                status={loadingMore ? 'loading' : hasMore ? 'more' : 'done'}
                moreLabel="继续向下滚动"
                onLoadMore={hasMore && !loadingMore ? () => void loadMoreResources() : undefined}
              />
            )}
          </PlushScrollbar>

          <PlushScrollbar as="aside" className="finder__detail" aria-label="内容详情">
            {detailItem ? (
              <FinderDetail
                item={detailItem}
                copied={copiedId === detailItem.id}
                imageRetryKey={imageRetryKey}
                openWithOptions={getOpenWithOptions(detailItem)}
                onOpenPath={openPath}
                onPreview={() => showPreview(detailItem)}
                onOpen={() => openItemInSafari(detailItem)}
                onFavorite={() => void handleFavorite(detailItem)}
                onDownload={() => void handleDownload(detailItem)}
                onCopy={() => void copyLink(detailItem)}
              />
            ) : (
              <EmptyState icon="◇" title="暂无内容" description="选择资源查看详情" />
            )}
          </PlushScrollbar>
        </div>

        {hasBatchSelection && (
          <div className="finder__batch-bar" role="toolbar" aria-label="批量操作">
            <strong>{selectedItems.length} 项已选择</strong>
            <button type="button" onClick={() => void favoriteBatch()}>
              收藏
            </button>
            <button type="button" onClick={() => void downloadBatch()}>
              下载
            </button>
            <button type="button" onClick={() => void copyBatchLinks()}>
              {copiedId === 'batch' ? '已复制' : '复制链接'}
            </button>
            <button type="button" onClick={saveResourcePackage}>
              {activePackage ? '加入资源包' : '新建资源包'}
            </button>
            <button type="button" onClick={clearSelection}>
              清除选择
            </button>
          </div>
        )}

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
              openItemInSafari(contextMenu.item);
            }
            closeContextMenu();
          }}
          openWithOptions={getOpenWithOptions(contextMenu.item)}
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
  suppressActive?: boolean;
  onOpenPath: (path: FinderPath) => void;
}

function FinderSidebarGroup({
  title,
  sections,
  currentPath,
  activeTagId,
  suppressActive = false,
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
            section.path === currentPath && !activeTagId && !suppressActive ? 'is-active' : ''
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
  imageRetryKey: number;
  refNode: (node: HTMLElement | null) => void;
  onSelect: (event: React.MouseEvent<HTMLElement>) => void;
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
  imageRetryKey,
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
        <PlushImage
          className="finder-card__icon"
          src={item.previewImage ?? item.icon}
          decorative
          retryKey={imageRetryKey}
          fallbackTitle="图片走丢了"
          fallbackDescription="稍后重试"
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
  openWithOptions: FinderOpenWithOption[];
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
  openWithOptions,
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
      {openWithOptions.length > 0 && (
        <>
          <span className="finder-context-menu__divider" />
          {openWithOptions.slice(0, 4).map((option) => (
            <button
              type="button"
              role="menuitem"
              key={option.id}
              onClick={() => {
                option.action();
                onClose();
              }}
            >
              用 {option.label} 打开
            </button>
          ))}
        </>
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
  imageRetryKey: number;
  openWithOptions: FinderOpenWithOption[];
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
  imageRetryKey,
  openWithOptions,
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
      <div className={`finder__preview ${item.previewImage ? 'finder__preview--image' : ''}`}>
        <PlushImage
          className="finder__detail-icon"
          src={item.previewImage ?? item.icon}
          alt={item.title}
          fit={item.previewImage ? 'cover' : 'contain'}
          retryKey={imageRetryKey}
          fallbackTitle="图片暂不可见"
          fallbackDescription="可以刷新资源"
        />
      </div>
      <div className="finder__identity">
        <div className="finder__detail-kind">{item.status ?? kindLabel(item.kind)}</div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>

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

      {openWithOptions.length > 0 && (
        <section className="finder__section">
          <span className="finder__section-title">打开方式</span>
          <div className="finder__open-with">
            {openWithOptions.map((option) => (
              <button type="button" key={option.id} onClick={option.action}>
                <span>{option.label}</span>
                <small>{option.detail}</small>
              </button>
            ))}
          </div>
        </section>
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
          <button type="button" className="finder__open finder__open--primary" onClick={onPreview}>
            预览
          </button>
        ) : resourceUrl ? (
          <button type="button" className="finder__open finder__open--primary" onClick={onOpen}>
            用 Safari 打开
          </button>
        ) : null}
        {folderTargetPath && (
          <button
            type="button"
            className="finder__open finder__open--primary"
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
          {imageState === 'loading' && (
            <PlushLoading
              className="image-preview__loading"
              title="载入预览"
              description="正在打开图片"
              variant="stage"
              size="lg"
            />
          )}
          <PlushImage
            className="image-preview__image"
            src={src}
            alt={item.title}
            fit="contain"
            draggable={false}
            fallbackTitle="预览失败"
            fallbackDescription="图片暂时打不开"
            style={{
              transform: `translate3d(${imageOffset.x}px, ${imageOffset.y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
            }}
            onLoad={() => setImageState('loaded')}
            onError={() => setImageState('error')}
            onRetry={() => setImageState('loading')}
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

function matchesTypeFilter(item: FinderItem, filter: FinderTypeFilter) {
  switch (filter) {
    case 'all':
      return true;
    case 'image':
      return item.mediaKind === 'image';
    case 'link':
      return Boolean(item.publicUrl) && item.mediaKind !== 'image';
    case 'tool':
      return isToolLikeItem(item);
    case 'downloadable':
      return Boolean(item.resourceId);
  }
}

function isToolLikeItem(item: FinderItem) {
  const text = [item.title, item.subtitle, item.body, item.status, ...(item.tags ?? [])]
    .join(' ')
    .toLowerCase();
  return ['tool', 'tools', '工具', 'json', 'base64', 'uuid', 'diff', 'csv', 'ai'].some((keyword) =>
    text.includes(keyword),
  );
}

function isDevToolCandidate(item: FinderItem) {
  const extension = item.extension?.toLowerCase();
  return extension === 'json' || extension === 'csv' || isToolLikeItem(item);
}

function isAudioItem(item: FinderItem) {
  const extension = item.extension?.toLowerCase();
  const text = [item.title, item.subtitle, item.body, item.status, ...(item.tags ?? [])]
    .join(' ')
    .toLowerCase();
  return (
    extension === 'mp3' ||
    extension === 'wav' ||
    extension === 'ogg' ||
    extension === 'm4a' ||
    text.includes('audio') ||
    text.includes('music') ||
    text.includes('音乐')
  );
}

function formatResourceText(item: FinderItem) {
  return [item.title, item.body, item.publicUrl, item.tags?.join(' / ')].filter(Boolean).join('\n');
}

function formatResourceNote(item: FinderItem) {
  const lines = [`# ${item.title}`, '', item.body];
  if (item.publicUrl) lines.push('', item.publicUrl);
  if (item.tags?.length) lines.push('', `标签：${item.tags.join('、')}`);
  if (item.creatorName) lines.push(`作者：${item.creatorName}`);
  return lines.filter(Boolean).join('\n');
}

function buildSavedSearchName(input: {
  keyword: string;
  tagName: string | null;
  typeLabel: string | null;
}) {
  const parts = [input.keyword.trim(), input.tagName, input.typeLabel].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '保存搜索';
}

function makeResourcePackageName(items: FinderItem[]) {
  if (items.length === 0) return '资源包';
  if (items.length === 1) return `${items[0].title} 资源包`;
  return `${items[0].title} 等 ${items.length} 项`;
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
