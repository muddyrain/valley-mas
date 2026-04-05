import { ImageIcon, Loader2, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  favoriteResource,
  getAllResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import ResourceCard, { ResourceCardSkeleton } from '@/components/ResourceCard';
import TypeFilterBar from '@/components/TypeFilterBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const RESOURCE_TYPES = [
  { label: '全部', value: '' },
  { label: '壁纸', value: 'wallpaper' },
  { label: '头像', value: 'avatar' },
];

const PAGE_SIZE = 20;

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
  const [resources, setResources] = useState<Resource[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeType, setActiveType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [favoritedMap, setFavoritedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllResources({
      page: 1,
      pageSize: PAGE_SIZE,
      type: activeType || undefined,
      keyword: keyword || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        const list = data.list ?? [];
        setResources(list);
        setTotal(data.total ?? 0);
        setPage(1);
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
  }, [activeType, keyword]);

  const handleLoadMore = async () => {
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const data = await getAllResources({
        page: nextPage,
        pageSize: PAGE_SIZE,
        type: activeType || undefined,
        keyword: keyword || undefined,
      });
      const list = data.list ?? [];
      setResources((prev) => [...prev, ...list]);
      setTotal(data.total ?? 0);
      setPage(nextPage);
      setFavoritedMap((prev) => {
        const map = { ...prev };
        list.forEach((r) => {
          map[r.id] = r.isFavorited ?? false;
        });
        return map;
      });
    } catch {
      toast.error('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = () => setKeyword(inputValue.trim());

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

  const hasMore = resources.length < total;
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
            </div>

            <div className="rounded-[32px] border border-white/80 bg-white/82 p-5 shadow-[0_20px_48px_rgba(148,163,184,0.08)] backdrop-blur">
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
            <TypeFilterBar
              options={RESOURCE_TYPES}
              value={activeType}
              onChange={setActiveType}
              prefix="类型："
              extra={
                keyword ? (
                  <span className="text-sm text-slate-400">
                    搜索“{keyword}”
                    <button
                      type="button"
                      onClick={() => {
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
              className="mb-6"
            />

            {loading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            ) : resources.length === 0 ? (
              <div className="rounded-[32px] bg-white/66 p-4">
                <EmptyState
                  icon={ImageIcon}
                  title="暂无资源"
                  description={
                    keyword ? `没有找到包含“${keyword}”的资源` : '这个分类下还没有资源内容'
                  }
                  actionLabel={keyword ? '清除搜索' : undefined}
                  onAction={
                    keyword
                      ? () => {
                          setKeyword('');
                          setInputValue('');
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

                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {resources.map((resource, index) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      isFavorited={favoritedMap[resource.id]}
                      onFavorite={handleFavorite}
                      showCreator
                      showDate
                      showEngagement
                      animationDelay={index * 30}
                    />
                  ))}
                </div>

                {hasMore ? (
                  <div className="mt-10 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="border-theme-soft-strong rounded-full border bg-white/82 px-8 text-slate-700"
                    >
                      {loadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          加载中
                        </>
                      ) : (
                        `加载更多（还剩 ${total - resources.length} 项）`
                      )}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
