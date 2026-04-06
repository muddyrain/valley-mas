import { ArrowRight, Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyFollows, type MyFollowItem } from '@/api/creator';
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
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 34%, white) 48%, var(--theme-page-cool) 100%)',
};

const BANNER_BACKGROUND = {
  background:
    'linear-gradient(135deg, rgba(var(--theme-primary-rgb),0.96) 0%, color-mix(in srgb, var(--theme-primary-hover) 76%, white) 52%, var(--theme-primary-deep) 100%)',
};

export default function Follows() {
  const navigate = useNavigate();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<MyFollowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFollows = async (nextPage: number, append: boolean) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const data = await getMyFollows({ page: nextPage, pageSize: PAGE_SIZE });
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
    void loadFollows(1, false);
  }, [hasHydrated, isAuthenticated, navigate]);

  const hasMore = items.length < total;

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner backgroundStyle={BANNER_BACKGROUND} padding="py-10" maxWidth="max-w-5xl">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-white/30 bg-white/18 p-3 shadow-lg backdrop-blur-md">
            <Users className="h-7 w-7 text-white" />
          </div>
          <div className="text-white">
            <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">我的关注</h1>
            <p className="mt-1 text-sm text-white/82">
              {loading ? '正在整理你关注的创作者...' : `已关注 ${total} 位创作者`}
            </p>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm"
              >
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-theme-shell-border bg-white/72 px-6 shadow-[0_20px_50px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm">
            <EmptyState
              icon={Users}
              title="还没有关注任何创作者"
              description="去创作者页面逛一逛，看到喜欢的内容后就先关注起来。"
              actionLabel="去看创作者"
              onAction={() => navigate('/creators')}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => {
                const creator = item.creator;
                const profile = creator?.user;
                const name = profile?.nickname || '未命名创作者';
                const code = creator?.code;

                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-theme-shell-border bg-white/86 shadow-[0_18px_40px_rgba(var(--theme-primary-rgb),0.10)] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(var(--theme-primary-rgb),0.16)]"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 border border-theme-soft-strong shadow-sm">
                          <AvatarImage src={profile?.avatar} alt={name} />
                          <AvatarFallback className="bg-theme-soft font-semibold text-theme-primary">
                            {name[0]?.toUpperCase() || 'C'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-slate-900">
                                {name}
                              </div>
                              <div className="mt-1 text-xs text-theme-primary">
                                {code ? `主页口令：${code}` : '创作者主页待完善'}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 rounded-xl border-theme-soft-strong bg-white/70 text-theme-primary hover:bg-theme-soft"
                              onClick={() => code && navigate(`/creator/${code}`)}
                              disabled={!code}
                            >
                              进入主页
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                            {creator?.description?.trim() || '这个创作者还没有留下更多介绍。'}
                          </p>

                          <div className="mt-4 text-xs text-slate-400">
                            关注于{' '}
                            {new Date(item.createdAt).toLocaleDateString('zh-CN', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
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
                  onClick={() => void loadFollows(page + 1, true)}
                  disabled={loadingMore}
                  className="rounded-xl border-theme-soft-strong bg-white/80 px-10 text-theme-primary hover:bg-theme-soft"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    `加载更多（还剩 ${total - items.length} 位）`
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
