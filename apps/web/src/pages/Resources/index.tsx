import { ExternalLink, Hash, ImageIcon, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { toast } from 'sonner';
import {
  favoriteResource,
  getAllResources,
  getUserResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  enumParam,
  numberParam,
  stringParam,
  useUrlQueryState,
} from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const PAGE_SIZE = 12;
const RESOURCE_LIST_CACHE_TTL_MS = 30_000;
const RESOURCE_LIST_SCROLL_STORAGE_PREFIX = 'resources-scroll:v1';

type ResourceListCacheEntry = {
  resources: Resource[];
  total: number;
  favoritedMap: Record<string, boolean>;
  updatedAt: number;
};

const resourceListCache = new Map<string, ResourceListCacheEntry>();
const RESOURCE_QUERY_SCHEMA = {
  page: numberParam(1, { min: 1 }),
  keyword: stringParam('', { resetPageOnChange: true }),
  type: enumParam(['', 'wallpaper', 'avatar'] as const, '', { resetPageOnChange: true }),
  tag: stringParam('', { resetPageOnChange: true }),
  userId: stringParam('', { resetPageOnChange: true }),
};

export default function Resources() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { user } = useAuthStore();
  const isLoggedIn = !!user;
  const {
    values: {
      page: currentPage,
      keyword: currentKeyword,
      type: activeType,
      tag: currentTag,
      userId: selectedUserId,
    },
    setValue,
  } = useUrlQueryState(RESOURCE_QUERY_SCHEMA, { pageKey: 'page' });

  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState(currentKeyword);
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  const [tagInput, setTagInput] = useState('');
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const firstLoadRef = useRef(true);
  const scrollRestoredRef = useRef(false);

  const [refreshing, setRefreshing] = useState(false);
  const listCacheKey = useMemo(
    () =>
      `${currentPage}|${activeType || ''}|${currentKeyword || ''}|${currentTag || ''}|${selectedUserId || ''}`,
    [activeType, currentKeyword, currentPage, currentTag, selectedUserId],
  );
  useEffect(() => {
    setInputValue(currentKeyword);
  }, [currentKeyword]);

  useEffect(() => {
    let cancelled = false;
    const cachedEntry = resourceListCache.get(listCacheKey);
    const hasCachedEntry = !!cachedEntry;
    const cacheFresh = hasCachedEntry
      ? Date.now() - cachedEntry.updatedAt < RESOURCE_LIST_CACHE_TTL_MS
      : false;

    if (cachedEntry) {
      setResources(cachedEntry.resources);
      setTotal(cachedEntry.total);
      setFavoritedMap(cachedEntry.favoritedMap);
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setLoading(false);
      }
    }

    if (cacheFresh) {
      setRefreshing(false);
      return () => {
        cancelled = true;
      };
    }

    const isFirstLoad = firstLoadRef.current && !hasCachedEntry;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    const loadResources = selectedUserId
      ? getUserResources(selectedUserId, {
          page: currentPage,
          pageSize: PAGE_SIZE,
          type: activeType || undefined,
          keyword: currentKeyword || undefined,
        })
      : getAllResources({
          page: currentPage,
          pageSize: PAGE_SIZE,
          type: activeType || undefined,
          keyword: currentKeyword || undefined,
          tag: currentTag || undefined,
          includeTags: true,
        });

    loadResources
      .then((data) => {
        if (cancelled) return;
        const list = data.list ?? [];
        const map: Record<string, boolean> = {};
        list.forEach((r) => {
          map[r.id] = r.isFavorited ?? false;
        });
        resourceListCache.set(listCacheKey, {
          resources: list,
          total: data.total ?? 0,
          favoritedMap: map,
          updatedAt: Date.now(),
        });
        setResources(list);
        setTotal(data.total ?? 0);
        setFavoritedMap(map);
      })
      .catch(() => {
        if (!cancelled) toast.error('加载资源失败');
      })
      .finally(() => {
        if (cancelled) return;
        if (isFirstLoad) {
          firstLoadRef.current = false;
          setLoading(false);
        }
        setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPage, activeType, currentKeyword, listCacheKey, currentTag, selectedUserId]);

  const handleSearch = () => {
    setValue('keyword', inputValue);
  };

  const applyTagFilter = (nextTag: string) => {
    const trimmed = nextTag.trim();
    setValue('tag', trimmed);
    setTagDropdownOpen(false);
    setTagInput('');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = selectedUserId
        ? await getUserResources(selectedUserId, {
            page: currentPage,
            pageSize: PAGE_SIZE,
            type: activeType || undefined,
            keyword: currentKeyword || undefined,
          })
        : await getAllResources({
            page: currentPage,
            pageSize: PAGE_SIZE,
            type: activeType || undefined,
            keyword: currentKeyword || undefined,
            tag: currentTag || undefined,
            includeTags: true,
          });
      const list = data.list ?? [];
      setResources(list);
      setTotal(data.total ?? 0);
      const map: Record<string, boolean> = {};
      list.forEach((r) => {
        map[r.id] = r.isFavorited ?? false;
      });
      resourceListCache.set(listCacheKey, {
        resources: list,
        total: data.total ?? 0,
        favoritedMap: map,
        updatedAt: Date.now(),
      });
      setFavoritedMap(map);
      toast.success('已刷新');
    } catch {
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    scrollRestoredRef.current = false;
    const scrollStorageKey = `${RESOURCE_LIST_SCROLL_STORAGE_PREFIX}:${location.pathname}${location.search}`;
    const saveScroll = () => {
      sessionStorage.setItem(scrollStorageKey, String(window.scrollY));
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveScroll);
      saveScroll();
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    const scrollStorageKey = `${RESOURCE_LIST_SCROLL_STORAGE_PREFIX}:${location.pathname}${location.search}`;
    if (navigationType !== 'POP') return;
    if (loading) return;
    if (scrollRestoredRef.current) return;

    const rawValue = sessionStorage.getItem(scrollStorageKey);
    if (!rawValue) {
      scrollRestoredRef.current = true;
      return;
    }

    const nextScrollY = Number(rawValue);
    if (!Number.isFinite(nextScrollY) || nextScrollY < 0) {
      scrollRestoredRef.current = true;
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollY, behavior: 'auto' });
      scrollRestoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [loading, navigationType, location.pathname, location.search]);

  const handleFavorite = async (e: React.MouseEvent, resource: Resource) => {
    e.stopPropagation();
    const isFav = favoritedMap[resource.id] ?? false;
    setFavoritedMap((prev) => ({ ...prev, [resource.id]: !isFav }));
    try {
      if (isFav) {
        await unfavoriteResource(resource.id);
        toast.success('已取消收藏');
      } else {
        await favoriteResource(resource.id);
        toast.success('收藏成功');
      }
    } catch {
      setFavoritedMap((prev) => ({ ...prev, [resource.id]: isFav }));
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const wallpaperCount = useMemo(
    () =>
      resources.filter((item) => item.type === 'wallpaper' || item.type === 'background').length,
    [resources],
  );
  const avatarCount = useMemo(
    () => resources.filter((item) => item.type === 'avatar').length,
    [resources],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:px-10">
        <Card className="overflow-hidden border-border/50 [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(6)]">
          <CardContent className="p-4 sm:p-8 md:p-10">
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1 text-xs text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    RESOURCES
                  </div>
                  <CardTitle className="text-2xl font-semibold sm:text-3xl md:text-4xl">
                    {selectedUserId ? '创作者公开资源' : '资源整理'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedUserId
                      ? '浏览这位创作者公开的壁纸、头像和图像资源。'
                      : '壁纸、头像和最近整理出的图像资源都会先汇在这里，方便继续浏览、筛选和收藏。'}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2 py-1.5 text-xs text-foreground sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
                    <ImageIcon className="h-4 w-4 text-primary" />共 {loading ? '...' : total}{' '}
                    项资源
                  </span>
                  <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2 py-1.5 text-xs text-foreground sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {wallpaperCount} 张壁纸
                  </span>
                  <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2 py-1.5 text-xs text-foreground sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {avatarCount} 个头像
                  </span>
                  {isLoggedIn && (
                    <Button
                      className="col-span-3 h-9 sm:col-auto sm:h-auto"
                      onClick={() => navigate(`/my-space/resources`)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      前往我的创作空间
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1 min-w-[200px] lg:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索资源标题"
                    className="pl-10"
                  />
                  {currentKeyword && (
                    <button
                      type="button"
                      onClick={() => {
                        setValue('keyword', '');
                        setInputValue('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <TypeFilterBar
                    options={RESOURCE_TYPES}
                    value={activeType}
                    onChange={(nextType) => {
                      setValue('type', nextType as '' | 'wallpaper' | 'avatar');
                    }}
                    className="w-full justify-between sm:w-auto sm:justify-start"
                  />

                  <div className="flex items-center gap-2">
                    {!selectedUserId ? (
                      <div className="relative">
                        {currentTag ? (
                          <div className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/50 px-3 py-2 text-sm font-medium text-primary">
                            <Hash className="h-4 w-4" />
                            {currentTag}
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              className="ml-0.5 rounded-full p-0.5 hover:bg-accent"
                              onClick={() => setValue('tag', '')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTagDropdownOpen(true);
                              setTagInput('');
                              setTimeout(() => tagInputRef.current?.focus(), 50);
                            }}
                          >
                            <Hash className="h-4 w-4 mr-1.5" />
                            按标签筛选
                          </Button>
                        )}

                        {tagDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setTagDropdownOpen(false)}
                            />
                            <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-border bg-background shadow-lg overflow-hidden">
                              <div className="p-3">
                                <div className="relative">
                                  <Hash className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                  <input
                                    ref={tagInputRef}
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (tagInput.trim()) applyTagFilter(tagInput);
                                      } else if (e.key === 'Escape') {
                                        setTagDropdownOpen(false);
                                      }
                                    }}
                                    placeholder="输入标签名后回车"
                                    className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                                  />
                                </div>
                                <p className="mt-2 px-1 text-xs text-muted-foreground">
                                  按标签名精确筛选资源，回车确认。
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}

                    <Button
                      variant="outline"
                      onClick={handleRefresh}
                      disabled={refreshing || loading}
                      title="刷新"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                      刷新
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-5 border-0 bg-transparent shadow-none ring-0 [--card-spacing:--spacing(3)] sm:mt-6 sm:border-border/50 sm:bg-card sm:shadow-sm sm:ring-1 sm:[--card-spacing:--spacing(6)]">
          <CardContent className="p-0 sm:p-5">
            <div className="relative min-h-[240px] sm:min-h-[280px]">
              {loading || refreshing ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <ResourceCardSkeleton
                      key={i}
                      type={activeType || undefined}
                      wideWallpaperOnDesktop
                    />
                  ))}
                </div>
              ) : resources.length === 0 ? (
                <Card className="border-dashed border-border">
                  <CardContent className="p-4">
                    <EmptyState
                      icon={ImageIcon}
                      title="暂无资源"
                      description={
                        currentKeyword
                          ? `没有找到包含"${currentKeyword}"的资源`
                          : currentTag
                            ? `标签"${currentTag}"下暂无资源`
                            : '这个分类下还没有资源内容'
                      }
                      actionLabel={
                        currentKeyword ? '清除搜索' : currentTag ? '清除标签' : undefined
                      }
                      onAction={
                        currentKeyword
                          ? () => {
                              setValue('keyword', '');
                              setInputValue('');
                            }
                          : currentTag
                            ? () => setValue('tag', '')
                            : undefined
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-end gap-3 sm:mb-6 sm:justify-between sm:gap-4">
                    <div className="hidden text-sm text-muted-foreground sm:block">
                      当前展示最近整理出的资源内容。
                    </div>
                    <div className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:border-0 sm:px-4 sm:py-2 sm:text-sm">
                      已显示 {resources.length} / {total}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
                    {resources.map((resource, index) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        isFavorited={favoritedMap[resource.id]}
                        onFavorite={handleFavorite}
                        showUser
                        showDate
                        showEngagement
                        showTags
                        animationDelay={index * 30}
                        wideWallpaperOnDesktop
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-7 flex items-center justify-center gap-3 sm:mt-10">
                <Button
                  variant="outline"
                  onClick={() => {
                    setValue('page', Math.max(1, currentPage - 1));
                  }}
                  disabled={currentPage <= 1 || loading}
                >
                  上一页
                </Button>
                <span className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    setValue('page', Math.min(totalPages, currentPage + 1));
                  }}
                  disabled={currentPage >= totalPages || loading}
                >
                  下一页
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
