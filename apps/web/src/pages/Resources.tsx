import { ImageIcon, Loader2, Search, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  favoriteResource,
  getAllResources,
  type Resource,
  unfavoriteResource,
} from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
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

  // 首次加载 & 筛选条件变化时重新拉第 1 页
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
    // 乐观更新
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
      // 回滚
      setFavoritedMap((prev) => ({ ...prev, [resource.id]: isFav }));
    }
  };

  const hasMore = resources.length < total;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* 头部 Banner */}
      <PageBanner>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">资源广场</h1>
              <p className="text-purple-200 text-sm mt-1">共 {loading ? '…' : total} 个资源</p>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="flex gap-2 w-full md:w-80">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索资源标题…"
                className="pl-9 bg-white/90 border-0 rounded-xl h-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              className="bg-white text-purple-600 hover:bg-gray-50 rounded-xl h-10 px-4 font-semibold shadow"
            >
              搜索
            </Button>
          </div>
        </div>
      </PageBanner>

      {/* 内容区 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 类型筛选 */}
        <TypeFilterBar
          options={RESOURCE_TYPES}
          value={activeType}
          onChange={setActiveType}
          prefix="类型："
          extra={
            keyword ? (
              <span className="text-sm text-gray-400">
                搜索「{keyword}」
                <button
                  type="button"
                  onClick={() => {
                    setKeyword('');
                    setInputValue('');
                  }}
                  className="ml-1.5 text-purple-500 hover:text-purple-700 underline"
                >
                  清除
                </button>
              </span>
            ) : null
          }
          className="mb-6"
        />

        {/* 资源网格 */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: PAGE_SIZE }).map((_, i) => (
              <ResourceCardSkeleton key={i} />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="暂无资源"
            description={keyword ? `没有找到包含「${keyword}」的资源` : '该分类下暂无资源'}
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
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

            {/* 加载更多 */}
            {hasMore && (
              <div className="flex justify-center mt-10">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-10 rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      加载中…
                    </>
                  ) : (
                    `加载更多（还剩 ${total - resources.length} 个）`
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
