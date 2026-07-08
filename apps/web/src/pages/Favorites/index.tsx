import { formatResourceType } from '@valley/shared-format';
import { Download, Heart, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMyFavorites, type Resource, unfavoriteResource } from '@/api/resource';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUrlPaginationQuery } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

interface FavoriteItem {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: string;
  resource?: Resource;
}

const PAGE_SIZE = 20;

export default function Favorites() {
  const navigate = useNavigate();
  const { page: currentPage, setPage } = useUrlPaginationQuery();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [removingSet, setRemovingSet] = useState<Set<string>>(new Set());

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const loadFavorites = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      const data = await getMyFavorites({ page: targetPage, pageSize: PAGE_SIZE });
      setItems(data.list ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    void loadFavorites(currentPage);
  }, [hasHydrated, isAuthenticated, loadFavorites, navigate, currentPage]);

  const handlePageChange = (targetPage: number) => {
    if (loading) return;
    const nextPage = Math.min(Math.max(1, targetPage), totalPages);
    if (nextPage === currentPage) return;
    setPage(nextPage);
  };

  const handleRemove = async (item: FavoriteItem) => {
    const rid = item.resource?.id ?? item.resourceId;
    setRemovingSet((prev) => new Set(prev).add(rid));

    try {
      await unfavoriteResource(rid);
      toast.success('已取消收藏');

      const nextTotal = Math.max(0, total - 1);
      setTotal(nextTotal);

      const nextTotalPages = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
      const nextPage = Math.min(currentPage, nextTotalPages);
      if (nextPage !== currentPage) {
        setPage(nextPage);
      } else {
        await loadFavorites(nextPage);
      }
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

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <PageBanner padding="py-10" maxWidth="max-w-5xl">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-foreground/15 bg-foreground/10 p-3">
            <Heart className="h-7 w-7 fill-foreground text-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">我的收藏</h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
                className="overflow-hidden rounded-2xl border border-border bg-card"
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
          <div className="rounded-2xl border border-border bg-card px-6">
            <EmptyState
              icon={Heart}
              title="还没有收藏"
              description="浏览首页、资源页或用户主页时，看到喜欢的内容就先收藏起来。"
              actionLabel="去逛逛"
              onAction={() => navigate('/')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => {
              const resource = item.resource;
              const resourceId = resource?.id ?? item.resourceId;
              const isRemoving = removingSet.has(resourceId);
              const userName = resource?.userName || '用户';

              return (
                <Card
                  key={item.id}
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5"
                  onClick={() => resource && navigate(`/resource/${resource.id}`)}
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    {resource?.url ? (
                      <img
                        src={resource.thumbnailUrl ?? resource.url}
                        alt={resource.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-muted-foreground" />
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
                        className="rounded-full bg-card/92 p-2 text-destructive shadow-md transition-all hover:scale-110 hover:bg-destructive/10 disabled:opacity-60"
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
                      <div className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-foreground backdrop-blur-sm">
                        {formatResourceType(resource.type)}
                      </div>
                    ) : null}
                  </div>

                  <CardContent className="p-3">
                    <p className="mb-1 truncate text-sm font-medium text-foreground">
                      {resource?.title || '未知资源'}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={resource?.userAvatar} />
                          <AvatarFallback className="bg-accent text-[8px] text-primary">
                            {userName[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="max-w-15 truncate">{userName}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Download className="h-3 w-3 text-primary" />
                        <span>{resource?.downloadCount ?? 0}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            className="rounded-xl border-border bg-card px-6 text-foreground hover:bg-accent"
          >
            上一页
          </Button>
          <div className="rounded-xl border border-border bg-card px-5 py-2 text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </div>
          <Button
            variant="outline"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            className="rounded-xl border-border bg-card px-6 text-foreground hover:bg-accent"
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
