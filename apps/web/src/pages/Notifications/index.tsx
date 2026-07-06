import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from '@/api/notification';
import EmptyState from '@/components/EmptyState';
import PageBanner from '@/components/PageBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUrlPaginationQuery } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  emitNotificationStateChanged,
  formatNotificationTime,
  getNotificationVisual,
  resolveNotificationTarget,
} from '@/utils/notification';

const PAGE_SIZE = 20;

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--background) 0%, color-mix(in srgb, hsl(var(--primary) / 0.15) 28%, hsl(var(--background))) 46%, var(--background) 100%)',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { page: currentPage, setPage } = useUrlPaginationQuery();
  const { hasHydrated, isAuthenticated } = useAuthStore();

  const [items, setItems] = useState<UserNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    const nextUnreadCount = items.filter((item) => !item.isRead).length;
    setUnreadCount(nextUnreadCount);
    emitNotificationStateChanged({ unreadCount: nextUnreadCount });
  }, [items]);

  const loadNotificationsToPage = async (targetPage: number) => {
    try {
      setLoading(true);
      let merged: UserNotification[] = [];
      let latestTotal = 0;
      for (let pageNo = 1; pageNo <= targetPage; pageNo += 1) {
        const data = await getMyNotifications(pageNo, PAGE_SIZE);
        merged = [...merged, ...(data.list ?? [])];
        latestTotal = data.total ?? latestTotal;
      }
      setItems(merged);
      setTotal(latestTotal);
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
    void loadNotificationsToPage(currentPage);
  }, [hasHydrated, isAuthenticated, navigate, currentPage]);

  const handleMarkOneRead = async (item: UserNotification) => {
    if (item.isRead) return true;
    try {
      await markNotificationRead(item.id);
      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, isRead: true, readAt: new Date().toISOString() }
            : current,
        ),
      );
      return true;
    } catch {
      // request.ts 已统一处理错误提示
      return false;
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount <= 0 || markingAll) return;
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((item) =>
          item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() },
        ),
      );
    } catch {
      // request.ts 已统一处理错误提示
    } finally {
      setMarkingAll(false);
    }
  };

  const hasMore = items.length < total;

  const handleOpenNotificationTarget = async (item: UserNotification) => {
    const target = resolveNotificationTarget(item);
    if (!target) {
      toast.info('这条通知暂不支持直接跳转，你可以先在对应页面查看。');
      return;
    }
    const marked = item.isRead ? true : await handleMarkOneRead(item);
    if (!marked) {
      toast.error('状态更新失败，暂未跳转。请稍后重试。');
      return;
    }
    navigate(target);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <PageBanner padding="py-10" maxWidth="max-w-5xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl border border-foreground/15 bg-foreground/10 p-3 shadow-lg backdrop-blur-md">
              <Bell className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-primary-foreground">
              <h1 className="text-2xl font-bold drop-shadow-lg md:text-3xl">通知中心</h1>
              <p className="mt-1 text-sm text-primary-foreground/82">
                {loading ? '正在整理你的最新动态...' : `共 ${total} 条通知，未读 ${unreadCount} 条`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleMarkAllRead}
            disabled={unreadCount <= 0 || markingAll}
            className="rounded-2xl border-primary-foreground/28 bg-primary-foreground/16 px-5 text-primary-foreground shadow-lg backdrop-blur-md hover:bg-primary-foreground/22 hover:text-primary-foreground disabled:border-primary-foreground/18 disabled:bg-primary-foreground/12 disabled:text-primary-foreground/68"
          >
            {markingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            全部设为已读
          </Button>
        </div>
      </PageBanner>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-border bg-card/86 shadow-[0_18px_40px_hsl(var(--primary) / 0.10)] backdrop-blur-sm"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-12 w-12 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-border bg-card/72 px-6 shadow-[0_20px_50px_hsl(var(--primary) / 0.10)] backdrop-blur-sm">
            <EmptyState
              icon={Bell}
              title="还没有收到通知"
              description="当创作者申请有结果，或后续系统动态有更新时，这里会第一时间提醒你。"
              actionLabel="去首页看看"
              onAction={() => navigate('/')}
            />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {items.map((item) => {
                const visual = getNotificationVisual(item.type, item.content);
                const Icon = visual.icon;
                const target = resolveNotificationTarget(item);

                return (
                  <Card
                    key={item.id}
                    className={`overflow-hidden rounded-2xl border bg-card/86 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_hsl(var(--primary) / 0.16)] ${
                      item.isRead
                        ? 'border-border shadow-[0_16px_36px_hsl(var(--foreground)/0.08)]'
                        : 'border-border shadow-[0_18px_44px_hsl(var(--primary) / 0.14)]'
                    }`}
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <div
                            className={`mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${visual.iconBgClass}`}
                          >
                            <Icon className={`h-5 w-5 ${visual.iconClass}`} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-foreground">
                                {item.title}
                              </h2>
                              {item.isRead ? (
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                  已读
                                </span>
                              ) : (
                                <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground">
                                  未读
                                </span>
                              )}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                              {item.content}
                            </p>
                            <p className="mt-3 text-xs text-muted-foreground">
                              {formatNotificationTime(item.createdAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenNotificationTarget(item)}
                            disabled={!target}
                            className="rounded-xl border-accent bg-card/75 text-primary hover:bg-accent disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                          >
                            查看详情
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleMarkOneRead(item)}
                            disabled={item.isRead}
                            className="rounded-xl border-accent bg-card/75 text-primary hover:bg-accent disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                          >
                            {item.isRead ? '已处理' : '标记已读'}
                          </Button>
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
                  className="rounded-xl border-accent bg-card/80 px-10 text-primary hover:bg-accent"
                >
                  {loading ? (
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
