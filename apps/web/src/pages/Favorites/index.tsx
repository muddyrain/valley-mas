import { Download, Heart, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMyFavorites, type Resource, unfavoriteResource } from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

interface FavoriteItem {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: string;
  resource?: Resource;
}

const PAGE_SIZE = 20;

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 24%, white) 44%, var(--theme-page-cool) 100%)',
};

const BANNER_BACKGROUND = {
  background:
    'linear-gradient(135deg, rgba(var(--theme-primary-rgb),0.96) 0%, color-mix(in srgb, rgba(var(--theme-tertiary-rgb),1) 26%, var(--theme-primary-hover)) 54%, var(--theme-primary-deep) 100%)',
};

function formatResourceType(type?: string) {
  if (type === 'wallpaper') return '壁纸';
  if (type === 'avatar') return '头像';
  return type || '资源';
}

export default function Favorites() {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [removingSet, setRemovingSet] = useState<Set<string>>(new Set());

  const loadFavorites = async (nextPage: number, append: boolean) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await getMyFavorites({ page: nextPage, pageSize: PAGE_SIZE });
      setTotal(data.total);
      setItems((prev) => (append ? [...prev, ...data.list] : data.list));
      setPage(nextPage);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    void loadFavorites(1, false);
  }, [hasHydrated, isAuthenticated, navigate]);

  const handleRemove = async (item: FavoriteItem) => {
    const rid = item.resource?.id ?? item.resourceId;
    setRemovingSet((prev) => new Set(prev).add(rid));
    try {
      await unfavoriteResource(rid);
      setItems((prev) => prev.filter((i) => (i.resource?.id ?? i.resourceId) !== rid));
      setTotal((count) => Math.max(0, count - 1));
      toast.success('已取消收藏');
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setRemovingSet((prev) => {
        const next = new Set(prev);
        next.delete(rid);
        return next;
      });
    }
  };

  const hasMore = items.length < total;

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-10" maxWidth="max-w-5xl">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-white/30 bg-white/18 p-3 shadow-lg backdrop-blur-md">
            <Heart className="h-7 w-7 fill-white text-white" />
          </div>
          <div className="text-white">
            <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">我的收藏</h1>
            <p className="mt-1 text-sm text-white/82">
              {loading ? '正在整理你收藏的内容...' : `共收藏 ${total} 个资源`}
            </p>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm"
              >
                <Skeleton className="aspect-square w-full" />
                <CardContent className="space-y-2 p-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <EmptyState
              icon={Heart}
              title="还没有收藏"
              description="浏览首页、资源页或创作者主页时，看到喜欢的内容就先收藏起来。"
              actionLabel="去逛逛"
              onAction={() => navigate('/')}
            />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((item) => {
                const resource = item.resource;
                const resourceId = resource?.id ?? item.resourceId;
                const isRemoving = removingSet.has(resourceId);
                const creatorName = resource?.creatorName || '创作者';

                return (
                  <Card
                    key={item.id}
                    className="group cursor-pointer overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(var(--theme-primary-rgb),0.16)]"
                    onClick={() => resource && navigate(`/resource/${resource.id}`)}
                  >
                    <div className="relative aspect-square overflow-hidden bg-slate-100">
                      {resource?.url ? (
                        <img
                          src={resource.thumbnailUrl ?? resource.url}
                          alt={resource.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-slate-300" />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/30 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleRemove(item);
                          }}
                          disabled={isRemoving}
                          className="rounded-full bg-white/92 p-2 text-rose-500 shadow-md transition-all hover:scale-110 hover:bg-rose-50 disabled:opacity-60"
                          title="取消收藏"
                        >
                          {isRemoving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {resource?.type ? (
                        <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
                          {formatResourceType(resource.type)}
                        </div>
                      ) : null}
                    </div>

                    <CardContent className="p-3">
                      <p className="mb-1 truncate text-sm font-medium text-slate-800">
                        {resource?.title || '未知资源'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <div className="flex min-w-0 items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={resource?.creatorAvatar} />
                            <AvatarFallback className="bg-theme-soft text-[8px] text-theme-primary">
                              {creatorName[0]?.toUpperCase() || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="max-w-15 truncate">{creatorName}</span>
                        </div>
                        <div className="flex items-center gap-0.5 text-theme-primary">
                          <Download className="h-3 w-3" />
                          <span className="text-slate-500">{resource?.downloadCount ?? 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => void loadFavorites(page + 1, true)}
                  disabled={loadingMore}
                  className="rounded-xl border-theme-soft-strong bg-white/80 px-10 text-theme-primary hover:bg-theme-soft"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    `加载更多（还剩 ${total - items.length} 个）`
                  )}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
