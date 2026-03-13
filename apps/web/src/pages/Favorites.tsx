import { Download, Heart, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMyFavorites, type Resource, unfavoriteResource } from '@/api/resource';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

// 与后端 UserFavorite JSON 结构对齐
interface FavoriteItem {
  id: string;
  userId: string;
  resourceId: string;
  createdAt: string;
  resource?: Resource;
}

export default function Favorites() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // 正在取消收藏的资源 id set
  const [removingSet, setRemovingSet] = useState<Set<string>>(new Set());

  const PAGE_SIZE = 20;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        const data = await getMyFavorites({ page: 1, pageSize: PAGE_SIZE });
        setTotal(data.total);
        setItems(data.list);
        setPage(1);
      } catch {
        toast.error('加载收藏列表失败');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAuthenticated, navigate]);

  const loadFavorites = async (p: number) => {
    try {
      setLoadingMore(true);
      const data = await getMyFavorites({ page: p, pageSize: PAGE_SIZE });
      setTotal(data.total);
      setItems((prev) => [...prev, ...data.list]);
      setPage(p);
    } catch {
      toast.error('加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRemove = async (item: FavoriteItem) => {
    const rid = item.resource?.id ?? item.resourceId;
    setRemovingSet((prev) => new Set(prev).add(rid));
    try {
      await unfavoriteResource(rid);
      setItems((prev) => prev.filter((i) => (i.resource?.id ?? i.resourceId) !== rid));
      setTotal((t) => t - 1);
      toast.success('已取消收藏');
    } catch {
      toast.error('操作失败，请重试');
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
    <div className="min-h-[calc(100vh-4rem)] bg-linear-to-br from-gray-50 via-purple-50/30 to-indigo-50/30">
      {/* 头部 Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-pink-500 via-purple-600 to-indigo-700">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 -left-4 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl" />
            <div className="absolute -bottom-8 right-20 w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl" />
          </div>
        </div>
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-lg">
              <Heart className="h-7 w-7 text-white fill-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">我的收藏</h1>
              <p className="text-purple-200 text-sm mt-1">
                共收藏了 {loading ? '…' : total} 个资源
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          // 骨架屏
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <Card key={i} className="border-0 shadow-md rounded-2xl overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          // 空状态
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="p-6 rounded-full bg-pink-50 mb-6">
              <Heart className="h-12 w-12 text-pink-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">还没有收藏</h3>
            <p className="text-gray-400 mb-6 max-w-xs">
              浏览首页或创作者主页，点击心形按钮收藏喜欢的资源
            </p>
            <Button
              onClick={() => navigate('/')}
              className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-8 rounded-xl"
            >
              去逛逛
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => {
                const res = item.resource;
                const rid = res?.id ?? item.resourceId;
                const isRemoving = removingSet.has(rid);

                return (
                  <Card
                    key={item.id}
                    className="group border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                    onClick={() => res?.userId && navigate(`/creator/${res.userId}`)}
                  >
                    {/* 缩略图 */}
                    <div className="relative aspect-square bg-gray-100 overflow-hidden">
                      {res?.thumbnailUrl ? (
                        <img
                          src={res.thumbnailUrl}
                          alt={res.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-gray-300" />
                        </div>
                      )}

                      {/* 悬浮操作遮罩 */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        {/* 取消收藏按钮 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(item);
                          }}
                          disabled={isRemoving}
                          className="p-2 rounded-full bg-white/90 hover:bg-red-50 text-red-500 shadow-md transition-all hover:scale-110 disabled:opacity-60"
                          title="取消收藏"
                        >
                          {isRemoving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* 类型标签 */}
                      {res?.type && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium bg-black/50 text-white backdrop-blur-sm">
                          {res.type === 'wallpaper'
                            ? '壁纸'
                            : res.type === 'avatar'
                              ? '头像'
                              : res.type}
                        </div>
                      )}
                    </div>

                    {/* 信息区 */}
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-gray-800 truncate mb-1">
                        {res?.title || '未知资源'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={res?.creatorAvatar} />
                            <AvatarFallback className="text-[8px] bg-purple-100 text-purple-600">
                              {res?.creatorName?.[0]?.toUpperCase() || 'C'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-15">{res?.creatorName || '-'}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Download className="h-3 w-3" />
                          <span>{res?.downloadCount ?? 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* 加载更多 */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  onClick={() => loadFavorites(page + 1)}
                  disabled={loadingMore}
                  className="px-10 rounded-xl border-purple-200 text-purple-600 hover:bg-purple-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      加载中…
                    </>
                  ) : (
                    `加载更多（还剩 ${total - items.length} 个）`
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
