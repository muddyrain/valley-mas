import { ArrowRight, Loader2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { type FollowItem, getMyFollows } from '@/api/follow';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUrlPaginationQuery } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_SIZE = 20;

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, hsl(var(--primary) / 0.15) 34%, hsl(var(--background))) 48%, var(--background) 100%)',
};

export default function Follows() {
  const navigate = useNavigate();
  const { page: currentPage, setPage } = useUrlPaginationQuery();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<FollowItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadFollowsToPage = async (targetPage: number) => {
    try {
      setLoading(true);
      let merged: FollowItem[] = [];
      let latestTotal = 0;
      for (let pageNo = 1; pageNo <= targetPage; pageNo += 1) {
        const data = await getMyFollows({ page: pageNo, pageSize: PAGE_SIZE });
        latestTotal = data.total;
        merged = [...merged, ...(data.list ?? [])];
      }
      setTotal(latestTotal);
      setItems(merged);
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    void loadFollowsToPage(currentPage);
  }, [hasHydrated, isAuthenticated, navigate, currentPage, loadFollowsToPage]);

  const hasMore = items.length < total;

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner padding="py-10" maxWidth="max-w-5xl">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-foreground/15 bg-foreground/10 p-3 shadow-lg backdrop-blur-md">
            <Users className="h-7 w-7 text-foreground" />
          </div>
          <div className="text-foreground">
            <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">我的关注</h1>
            <p className="mt-1 text-sm text-foreground/82">
              {loading ? '正在整理你关注的用户...' : `已关注 ${total} 位用户`}
            </p>
          </div>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="overflow-hidden rounded-2xl border border-border">
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
          <div className="rounded-2xl border border-border bg-card px-6">
            <EmptyState
              icon={Users}
              title="还没有关注任何用户"
              description="去资源页逛一逛，看到喜欢的内容后就先关注起来。"
              actionLabel="去看资源"
              onAction={() => navigate('/resources')}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map((item) => {
                const followedUser = item.followedUser;
                const name = followedUser?.nickname || '未命名用户';

                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:shadow-md"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-14 w-14 border border-accent shadow-sm">
                          <AvatarImage src={followedUser?.avatar} alt={name} />
                          <AvatarFallback className="bg-accent font-semibold text-primary">
                            {name[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-foreground">
                                {name}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 rounded-xl border-accent bg-card/70 text-primary hover:bg-accent"
                              disabled
                            >
                              查看主页
                              <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Button>
                          </div>

                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                            {followedUser?.description?.trim() || '这个用户还没有留下更多介绍。'}
                          </p>

                          <div className="mt-4 text-xs text-muted-foreground">
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
                  onClick={() => setPage(currentPage + 1)}
                  disabled={loading}
                  className="rounded-xl border-accent px-10 text-primary hover:bg-accent"
                >
                  {loading ? (
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
