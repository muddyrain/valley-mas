import { ExternalLink, Hash, ImageIcon, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { toast } from 'sonner';
import {
  favoriteResource,
  getAllResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
};

export default function Resources() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { user } = useAuthStore();
  const isLoggedIn = !!user;
  const {
    values: { page: currentPage, keyword: currentKeyword, type: activeType, tag: currentTag },
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
    () => `${currentPage}|${activeType || ''}|${currentKeyword || ''}|${currentTag || ''}`,
    [activeType, currentKeyword, currentPage, currentTag],
  );
  const scrollStorageKey = useMemo(
    () => `${RESOURCE_LIST_SCROLL_STORAGE_PREFIX}:${location.pathname}${location.search}`,
    [location.pathname, location.search],
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

    getAllResources({
      page: currentPage,
      pageSize: PAGE_SIZE,
      type: activeType || undefined,
      keyword: currentKeyword || undefined,
      tag: currentTag || undefined,
      includeTags: true,
    })
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
  }, [currentPage, activeType, currentKeyword, listCacheKey, currentTag]);

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
      const data = await getAllResources({
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
    const saveScroll = () => {
      sessionStorage.setItem(scrollStorageKey, String(window.scrollY));
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveScroll);
      saveScroll();
    };
  }, [scrollStorageKey]);

  useEffect(() => {
    scrollRestoredRef.current = false;
  }, [scrollStorageKey]);

  useEffect(() => {
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
  }, [loading, navigationType, scrollStorageKey]);

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
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-6 sm:p-8 md:p-10">
            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
              <div className="space-y-6">
                <CardHeader>
                  <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-3 py-1 text-xs text-primary mb-2">
                    <Sparkles className="h-3.5 w-3.5" />
                    RESOURCES
                  </div>
                  <CardTitle className="text-3xl md:text-4xl">资源整理</CardTitle>
                </CardHeader>
                <p className="text-sm text-muted-foreground">
                  壁纸、头像和最近整理出的图像资源都会先汇在这里，方便继续浏览、筛选和收藏。
                </p>

                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
                    <ImageIcon className="h-4 w-4 text-primary" />共 {loading ? '...' : total}{' '}
                    项资源
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {wallpaperCount} 张壁纸
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {avatarCount} 个头像
                  </span>
                </div>

                {isLoggedIn && (
                  <Button onClick={() => navigate(`/my-space/resources`)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    前往我的创作空间
                  </Button>
                )}
              </div>

              <Card className="border-border/50">
                <CardContent className="p-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary mb-4">
                    <Search className="h-3.5 w-3.5" />
                    资源检索
                  </div>

                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="搜索资源标题"
                        className="pl-9"
                      />
                    </div>
                    <Button onClick={handleSearch}>搜索</Button>
                  </div>

                  <div className="mt-4 rounded-lg bg-accent/50 p-4 text-sm text-muted-foreground">
                    当前可以按类型筛选，也可以直接搜索资源标题。
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 mt-6">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <TypeFilterBar
                options={RESOURCE_TYPES}
                value={activeType}
                onChange={(nextType) => {
                  setValue('type', nextType as '' | 'wallpaper' | 'avatar');
                }}
                prefix="类型："
                extra={
                  currentKeyword ? (
                    <span className="text-sm text-muted-foreground">
                      搜索"{currentKeyword}"
                      <button
                        type="button"
                        onClick={() => {
                          setValue('keyword', '');
                          setInputValue('');
                        }}
                        className="text-primary ml-1.5 underline hover:opacity-80"
                      >
                        清除
                      </button>
                    </span>
                  ) : null
                }
                className="flex-1"
              />

              <div className="relative">
                {currentTag ? (
                  <div className="flex items-center gap-1.5 rounded-full border border-accent bg-accent/50 px-3 py-1.5 text-sm text-primary">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="font-medium">{currentTag}</span>
                    <button
                      type="button"
                      onClick={() => setValue('tag', '')}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-accent transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTagDropdownOpen(true);
                      setTagInput('');
                      setTimeout(() => tagInputRef.current?.focus(), 50);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:text-primary transition-colors"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    按标签筛选
                  </button>
                )}

                {tagDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTagDropdownOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-lg border border-border bg-background shadow-lg overflow-hidden">
                      <div className="p-2">
                        <div className="relative">
                          <Hash className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
                            className="w-full rounded-lg border border-border bg-card py-1.5 pl-7 pr-3 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent"
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

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                title="刷新"
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground hover:border-accent hover:text-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            <div className="relative min-h-[280px]">
              {loading && resources.length === 0 ? (
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3">
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
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="text-sm text-muted-foreground">
                      当前展示最近整理出的资源内容。
                    </div>
                    <div className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground">
                      已显示 {resources.length} / {total}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-5 sm:grid-cols-2 md:grid-cols-3">
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
              <BoxLoadingOverlay
                show={(loading && resources.length > 0) || refreshing}
                title={refreshing ? '正在刷新资源列表...' : '正在加载资源列表...'}
                hint={refreshing ? '最新内容同步中' : '筛选结果更新中'}
              />
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-3">
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
