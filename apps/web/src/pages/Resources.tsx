import {
  ExternalLink,
  Hash,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  favoriteResource,
  getAllResources,
  getPublicResourceTags,
  type Resource,
  type ResourceTag,
  unfavoriteResource,
} from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/useAuthStore';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const PAGE_SIZE = 8;

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="border-theme-soft-strong inline-flex items-center rounded-full border bg-white/82 px-4 py-1.5 text-[11px] tracking-[0.32em] text-theme-primary uppercase shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)] backdrop-blur">
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2 className="text-[36px] font-semibold tracking-[-0.04em] text-slate-950 md:text-[42px]">
          {title}
        </h2>
        <p className="max-w-2xl text-[15px] leading-8 text-slate-500 md:text-base">{description}</p>
      </div>
    </div>
  );
}

export default function Resources() {
  const navigate = useNavigate();
  const { user, profile, fetchProfile } = useAuthStore();
  const isCreator = user?.role === 'creator';

  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  // 标签筛选
  const [activeTag, setActiveTag] = useState<ResourceTag | null>(null);
  const [tagKeyword, setTagKeyword] = useState('');
  const [tagResults, setTagResults] = useState<ResourceTag[]>([]);
  const [tagSearching, setTagSearching] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // 刷新
  const [refreshing, setRefreshing] = useState(false);

  // 若是创作者，预加载 profile 以获取 creatorCode
  useEffect(() => {
    if (isCreator) void fetchProfile();
  }, [isCreator, fetchProfile]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllResources({
      page,
      pageSize: PAGE_SIZE,
      type: activeType || undefined,
      keyword: keyword || undefined,
      tagId: activeTag?.id || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const list = data.list ?? [];
        setResources(list);
        setTotal(data.total ?? 0);
        const map: Record<string, boolean> = {};
        list.forEach((r) => {
          map[r.id] = r.isFavorited ?? false;
        });
        setFavoritedMap(map);
      })
      .catch(() => {
        if (!cancelled) toast.error('加载资源失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, activeType, keyword, activeTag?.id]);
  const handleSearch = () => {
    setPage(1);
    setKeyword(inputValue.trim());
  };

  // 标签关键词搜索（防抖 300ms）
  useEffect(() => {
    if (!tagDropdownOpen) return;
    const timer = setTimeout(async () => {
      setTagSearching(true);
      try {
        const data = await getPublicResourceTags({ keyword: tagKeyword, pageSize: 30 });
        setTagResults(data.list ?? []);
      } catch {
        // 静默
      } finally {
        setTagSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [tagKeyword, tagDropdownOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getAllResources({
        page,
        pageSize: PAGE_SIZE,
        type: activeType || undefined,
        keyword: keyword || undefined,
        tagId: activeTag?.id || undefined,
      });
      const list = data.list ?? [];
      setResources(list);
      setTotal(data.total ?? 0);
      const map: Record<string, boolean> = {};
      list.forEach((r) => {
        map[r.id] = r.isFavorited ?? false;
      });
      setFavoritedMap(map);
      toast.success('已刷新');
    } catch {
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

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

  const totalPages = Math.ceil(total / PAGE_SIZE);
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
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-8 md:px-10 md:py-10">
          <div className="theme-hero-glow absolute inset-0" />
          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <SectionTitle
                eyebrow="RESOURCES"
                title="资源整理"
                description="壁纸、头像和最近整理出的图像资源都会先汇在这里，方便继续浏览、筛选和收藏。"
              />

              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <ImageIcon className="text-theme-primary h-4 w-4" />共 {loading ? '...' : total}{' '}
                  项资源
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <Sparkles className="h-4 w-4 text-theme-primary" />
                  {wallpaperCount} 张壁纸
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <Sparkles className="h-4 w-4 text-theme-primary" />
                  {avatarCount} 个头像
                </div>
              </div>

              {/* 创作者快捷入口 */}
              {isCreator && profile?.creatorCode && (
                <div>
                  <Button
                    onClick={() => navigate(`/my-space/resources`)}
                    className="theme-btn-primary gap-2 rounded-full px-5 font-semibold shadow-md"
                  >
                    <ExternalLink className="h-4 w-4" />
                    前往我的创作者资源页
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-4xl border border-white/80 bg-white/82 p-5 shadow-[0_20px_48px_rgba(148,163,184,0.08)] backdrop-blur">
              <div className="bg-theme-soft text-theme-primary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs">
                <Search className="h-3.5 w-3.5" />
                资源检索
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="搜索资源标题"
                    className="h-11 rounded-full border-theme-border bg-theme-soft pl-9"
                  />
                </div>
                <Button
                  onClick={handleSearch}
                  className="h-11 rounded-full bg-slate-950 px-5 text-white hover:bg-slate-800"
                >
                  搜索
                </Button>
              </div>

              <div className="mt-4 rounded-[22px] border border-theme-shell-border bg-theme-soft p-4 text-sm leading-7 text-slate-500">
                当前可以按类型筛选，也可以直接搜索资源标题。
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24">
          <div className="theme-panel-shell rounded-[36px] border p-5 md:p-6">
            {/* 筛选栏：类型 + 标签 + 刷新 */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <TypeFilterBar
                options={RESOURCE_TYPES}
                value={activeType}
                onChange={(nextType) => {
                  setPage(1);
                  setActiveType(nextType);
                }}
                prefix="类型："
                extra={
                  keyword ? (
                    <span className="text-sm text-slate-400">
                      搜索"{keyword}"
                      <button
                        type="button"
                        onClick={() => {
                          setPage(1);
                          setKeyword('');
                          setInputValue('');
                        }}
                        className="text-theme-primary ml-1.5 underline hover:opacity-80"
                      >
                        清除
                      </button>
                    </span>
                  ) : null
                }
                className="flex-1"
              />

              {/* 标签筛选 */}
              <div className="relative">
                {activeTag ? (
                  <div className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 pl-3 pr-1.5 py-1.5 text-sm text-purple-700">
                    <Hash className="h-3.5 w-3.5" />
                    <span className="font-medium">{activeTag.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setPage(1);
                        setActiveTag(null);
                      }}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-purple-200 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTagDropdownOpen(true);
                      setTagKeyword('');
                      setTimeout(() => tagInputRef.current?.focus(), 50);
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/82 px-3 py-1.5 text-sm text-slate-500 hover:border-purple-200 hover:text-purple-600 transition-colors"
                  >
                    <Hash className="h-3.5 w-3.5" />
                    按标签筛选
                  </button>
                )}

                {tagDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setTagDropdownOpen(false)} />
                    <div className="absolute right-0 top-full z-20 mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            ref={tagInputRef}
                            value={tagKeyword}
                            onChange={(e) => setTagKeyword(e.target.value)}
                            placeholder="搜索标签…"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-sm outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100"
                          />
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto py-1">
                        {tagSearching ? (
                          <div className="flex items-center justify-center py-6 text-slate-400">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            搜索中…
                          </div>
                        ) : tagResults.length === 0 ? (
                          <p className="py-6 text-center text-sm text-slate-400">
                            {tagKeyword ? '未找到匹配标签' : '输入关键词搜索标签'}
                          </p>
                        ) : (
                          tagResults.map((tag) => (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                setPage(1);
                                setActiveTag(tag);
                                setTagDropdownOpen(false);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-purple-50 transition-colors"
                            >
                              <Hash className="h-3.5 w-3.5 shrink-0 text-purple-400" />
                              <span className="flex-1 truncate">{tag.name}</span>
                              <span className="shrink-0 text-xs text-slate-400">
                                {tag.resourceCount}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 刷新按钮 */}
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing || loading}
                title="刷新"
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/82 px-3 py-1.5 text-sm text-slate-500 hover:border-theme-soft-strong hover:text-theme-primary transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-4xl bg-white/66 p-4">
                <EmptyState
                  icon={ImageIcon}
                  title="暂无资源"
                  description={
                    keyword
                      ? `没有找到包含"${keyword}"的资源`
                      : activeTag
                        ? `标签"${activeTag.name}"下暂无资源`
                        : '这个分类下还没有资源内容'
                  }
                  actionLabel={keyword ? '清除搜索' : activeTag ? '清除标签' : undefined}
                  onAction={
                    keyword
                      ? () => {
                          setPage(1);
                          setKeyword('');
                          setInputValue('');
                        }
                      : activeTag
                        ? () => {
                            setPage(1);
                            setActiveTag(null);
                          }
                        : undefined
                  }
                />
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-500">当前展示最近整理出的资源内容。</div>
                  <div className="rounded-full bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_rgba(148,163,184,0.06)]">
                    已显示 {resources.length} / {total}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4">
                  {resources.map((resource, index) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      isFavorited={favoritedMap[resource.id]}
                      onFavorite={handleFavorite}
                      showCreator
                      showDate
                      showEngagement
                      showTags
                      animationDelay={index * 30}
                    />
                  ))}
                </div>
              </>
            )}
            {totalPages > 1 ? (
              <div className="mt-10 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={page <= 1 || loading}
                  className="border-theme-soft-strong rounded-full border bg-white/82 px-5 text-slate-700"
                >
                  上一页
                </Button>
                <div className="rounded-full bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_rgba(148,163,184,0.06)]">
                  {page} / {totalPages}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={page >= totalPages || loading}
                  className="border-theme-soft-strong rounded-full border bg-white/82 px-5 text-slate-700"
                >
                  下一页
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
