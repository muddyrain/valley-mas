import { Loader2, MessageCircleHeart, Pin, SendHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createGuestbookMessage,
  deleteGuestbookMessage,
  type GuestbookMessage,
  getGuestbookMessages,
  updateGuestbookMessagePin,
} from '@/api/guestbook';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import EmptyState from '@/components/EmptyState';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { openConfirmToast } from '@/components/ui/confirm-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useUrlPaginationQuery } from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_SIZE = 16;

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function hashSeed(input: string) {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getNoteStyle(id: string, index: number) {
  const seed = hashSeed(`${id}-${index}`);
  const rotate = (seed % 15) - 7;
  const lift = ((seed >> 3) % 11) - 5;

  return {
    transform: `rotate(${rotate}deg) translateY(${lift}px)`,
  };
}

export default function Guestbook() {
  const navigate = useNavigate();
  const { page: currentPage, setPage } = useUrlPaginationQuery();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();
  const [messages, setMessages] = useState<GuestbookMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string>('');
  const [pinningId, setPinningId] = useState<string>('');
  const [content, setContent] = useState('');

  const loadMessagesToPage = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      let merged: GuestbookMessage[] = [];
      let latestTotal = 0;
      for (let pageNo = 1; pageNo <= targetPage; pageNo += 1) {
        const data = await getGuestbookMessages({ page: pageNo, pageSize: PAGE_SIZE });
        merged = [...merged, ...(data.list ?? [])];
        latestTotal = data.total ?? latestTotal;
      }
      setMessages(merged);
      setTotal(latestTotal);
    } catch {
      // request.ts handles toast globally
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    void loadMessagesToPage(currentPage);
  }, [hasHydrated, loadMessagesToPage, currentPage]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    void loadMessagesToPage(currentPage);
  }, [hasHydrated, isAuthenticated, loadMessagesToPage, currentPage]);

  const remainingCount = Math.max(0, total - messages.length);
  const canLoadMore = messages.length < total;
  const contentCount = useMemo(() => content.trim().length, [content]);

  const handleSubmit = async () => {
    if (submitting) return;

    if (!isAuthenticated) {
      toast.error('请先登录后再留言');
      navigate('/login');
      return;
    }
    if (!content.trim()) {
      toast.error('请写一点留言内容');
      return;
    }

    try {
      setSubmitting(true);
      await createGuestbookMessage({ content: content.trim() });
      toast.success('留言已上墙，欢迎常来');
      setContent('');
      setPage(1);
    } catch {
      // request.ts handles toast globally
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: GuestbookMessage) => {
    if (deletingId) return;
    const runDelete = async () => {
      try {
        setDeletingId(item.id);
        await deleteGuestbookMessage(item.id);
        setMessages((prev) => prev.filter((message) => message.id !== item.id));
        setTotal((prev) => Math.max(0, prev - 1));
        toast.success('留言已删除');
      } catch {
        // request.ts handles toast globally
      } finally {
        setDeletingId('');
      }
    };

    openConfirmToast({
      title: '确认删除这条留言？',
      description: '删除后不可恢复',
      confirmText: '确认删除',
      cancelText: '取消',
      confirmVariant: 'danger',
      onConfirm: runDelete,
    });
  };

  const handleTogglePin = async (item: GuestbookMessage) => {
    if (pinningId) return;
    try {
      setPinningId(item.id);
      await updateGuestbookMessagePin(item.id, !item.isPinned);
      toast.success(item.isPinned ? '已取消置顶' : '已置顶到顶部');
      setPage(1);
    } catch {
      // request.ts handles toast globally
    } finally {
      setPinningId('');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground sm:text-xl">
                <MessageCircleHeart className="h-5 w-5 text-primary" />
                灵感留言板
              </h1>
              <span className="rounded-full border border-accent bg-accent px-3 py-1 text-xs font-medium text-primary">
                已上墙 {total} 条
              </span>
            </div>

            <p className="mb-3 text-xs leading-5 text-muted-foreground">
              这是你的灵感板，输入内容后会直接贴到板面上。留言自动使用当前账号头像和昵称。
            </p>

            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">留言内容</span>
                <span className={contentCount > 450 ? 'text-primary' : 'text-muted-foreground'}>
                  {contentCount}/500
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full rounded-2xl border border-border bg-card/92 px-3 py-2.5 text-sm leading-6 text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-ring"
                placeholder="写点什么贴上来，比如最近在做的作品、灵感或一句话..."
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {isAuthenticated ? '已登录，可直接发布' : '登录后可发布留言'}
              </span>
              <div className="flex items-center gap-2">
                {!isAuthenticated ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="rounded-xl border-accent text-primary hover:bg-accent"
                  >
                    去登录
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="rounded-xl px-5 text-sm font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      上墙中...
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      贴到留言
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 min-h-[520px]">
            <BoxLoadingOverlay
              show={loading}
              title="留言板加载中..."
              hint="正在贴上所有便签"
              className="rounded-2xl"
            />

            {loading ? (
              <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-5/6" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                icon={MessageCircleHeart}
                title="留言板还是空的"
                description="写下第一条留言，让这块板子亮起来。"
                padding="py-24"
              />
            ) : (
              <>
                <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {messages.map((item, index) => {
                    const canDelete =
                      item.canDelete ||
                      (Boolean(user?.id) && item.userId === user?.id) ||
                      user?.role === 'admin';
                    const canPin = item.canPin || user?.role === 'admin';

                    return (
                      <article
                        key={item.id}
                        style={getNoteStyle(item.id, index)}
                        className="relative rounded-2xl border border-border/35 bg-card p-4 transition-all duration-300 hover:scale-[1.02]"
                      >
                        <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-border/40 bg-primary" />
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar className="h-9 w-9 border border-border/35">
                              <AvatarImage src={item.avatar} alt={item.nickname} />
                              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                                {(item.nickname?.[0] || 'V').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {item.nickname}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {formatMessageTime(item.createdAt)}
                              </p>
                            </div>
                          </div>
                          {item.isPinned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-primary">
                              <Pin className="h-3 w-3" />
                              置顶
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                          {item.content}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-card/72 px-2 py-0.5 text-[11px] text-primary">
                            <Sparkles className="h-3 w-3" />
                            便签模式
                          </span>
                          <div className="flex items-center gap-1.5">
                            {canPin ? (
                              <button
                                type="button"
                                onClick={() => void handleTogglePin(item)}
                                disabled={pinningId === item.id}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  item.isPinned
                                    ? 'border-accent bg-accent text-primary'
                                    : 'border-primary/30 bg-accent/80 text-primary hover:bg-accent'
                                }`}
                              >
                                {pinningId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" />
                                )}
                                {item.isPinned ? '取消置顶' : '置顶'}
                              </button>
                            ) : null}

                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                disabled={deletingId === item.id}
                                className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive transition hover:bg-destructive/15 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                删除
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {canLoadMore ? (
                  <div className="mt-6 flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPage(currentPage + 1)}
                      disabled={loading}
                      className="rounded-xl border-accent text-primary hover:bg-accent"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          加载中...
                        </>
                      ) : (
                        `再贴一些（剩余 ${remainingCount} 条）`
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
