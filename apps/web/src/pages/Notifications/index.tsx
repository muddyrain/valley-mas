import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type UserNotification,
} from '@/api/notification';
import EmptyState from '@/components/EmptyState';
import PersonalPageHeader from '@/components/PersonalPageHeader';
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

  const loadNotificationsToPage = useCallback(async (targetPage: number) => {
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
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    void loadNotificationsToPage(currentPage);
  }, [hasHydrated, isAuthenticated, navigate, currentPage, loadNotificationsToPage]);

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
    <div className="min-h-[calc(100vh-4rem)]">
      <PersonalPageHeader
        icon={Bell}
        title="通知中心"
        description={
          loading ? '正在整理你的最新动态...' : `共 ${total} 条通知，未读 ${unreadCount} 条`
        }
        actions={
          <Button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount <= 0 || markingAll}
            className="rounded-xl px-5"
          >
            {markingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            全部设为已读
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card
                key={index}
                className="overflow-hidden rounded-2xl border border-border bg-card"
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
          <div className="rounded-2xl border border-border bg-card px-6">
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
                    className={`overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-200 hover:border-foreground/25 hover:shadow-sm ${
                      item.isRead ? 'border-border' : 'border-foreground/20 shadow-sm'
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
                            className="rounded-xl border-border bg-card text-foreground hover:bg-accent disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
                          >
                            查看详情
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleMarkOneRead(item)}
                            disabled={item.isRead}
                            className="rounded-xl border-border bg-card text-foreground hover:bg-accent disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
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
                  className="rounded-xl border-border bg-card px-10 text-foreground hover:bg-accent"
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
