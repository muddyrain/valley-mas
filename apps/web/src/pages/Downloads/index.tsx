import { Download, ExternalLink, ImageIcon, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type DownloadHistoryItem, getMyDownloads } from '@/api/auth';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_SIZE = 20;

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-surface-alt) 58%, white) 44%, var(--theme-page-cool) 100%)',
};

function formatSize(size?: number) {
  if (!size || size <= 0) return '大小未知';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatResourceType(type?: string) {
  if (type === 'wallpaper') return '壁纸';
  if (type === 'avatar') return '头像';
  return type || '资源';
}

export default function Downloads() {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<DownloadHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadDownloads = async (nextPage: number, append: boolean) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await getMyDownloads({ page: nextPage, pageSize: PAGE_SIZE });
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
    void loadDownloads(1, false);
  }, [hasHydrated, isAuthenticated, navigate]);

  const hasMore = items.length < total;

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner padding="py-10" maxWidth="max-w-5xl">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-white/30 bg-white/18 p-3 shadow-lg backdrop-blur-md">
            <Download className="h-7 w-7 text-white" />
          </div>
          <div className="text-white">
            <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">下载记录</h1>
            <p className="mt-1 text-sm text-white/82">
              {loading ? '正在整理你的下载历史...' : `累计下载 ${total} 次`}
            </p>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm"
              >
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <Skeleton className="h-22 w-22 shrink-0 rounded-2xl" />
                    <div className="flex-1 space-y-3">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <EmptyState
              icon={Download}
              title="还没有下载记录"
              description="浏览资源详情页后下载喜欢的内容，这里会帮你把记录留住。"
              actionLabel="去看资源"
              onAction={() => navigate('/resources')}
            />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => {
                const resource = item.resource;
                const creator = item.creator;
                const creatorName = creator?.user?.nickname || '创作者';

                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(var(--theme-primary-rgb),0.16)]"
                  >
                    <CardContent className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="h-24 w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:w-24">
                          {resource?.url ? (
                            <img
                              src={resource.thumbnailUrl ?? resource.url}
                              alt={resource.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-8 w-8 text-slate-300" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-slate-900">
                                {resource?.title || '资源已不可用'}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                <span>{formatResourceType(resource?.type)}</span>
                                <span>{formatSize(resource?.size)}</span>
                                <span>
                                  下载于{' '}
                                  {new Date(item.createdAt).toLocaleString('zh-CN', {
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 rounded-xl border-theme-soft-strong bg-white/70 text-theme-primary hover:bg-theme-soft"
                              onClick={() => resource && navigate(`/resource/${resource.id}`)}
                              disabled={!resource?.id}
                            >
                              查看资源
                              <ExternalLink className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                            <Avatar className="h-6 w-6 border border-theme-soft-strong">
                              <AvatarImage src={creator?.user?.avatar} alt={creatorName} />
                              <AvatarFallback className="bg-theme-soft text-[10px] font-semibold text-theme-primary">
                                {creatorName[0]?.toUpperCase() || 'C'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">
                              {creatorName}
                              {creator?.code ? ` · ${creator.code}` : ''}
                            </span>
                          </div>
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
                  onClick={() => void loadDownloads(page + 1, true)}
                  disabled={loadingMore}
                  className="rounded-xl border-theme-soft-strong bg-white/80 px-10 text-theme-primary hover:bg-theme-soft"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    `加载更多（还剩 ${total - items.length} 条）`
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
