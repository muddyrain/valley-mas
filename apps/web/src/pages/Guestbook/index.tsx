import { Loader2, MessageCircleHeart, Pin, SendHorizontal, Sparkles, Trash2 } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
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

const PAGE_BACKGROUND = {
  background:
    'linear-gradient(180deg, var(--theme-page-start) 0%, color-mix(in srgb, var(--theme-primary-soft) 30%, white) 38%, var(--theme-page-cool) 100%)',
};

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

function getNoteStyle(id: string, index: number): CSSProperties {
  const seed = hashSeed(`${id}-${index}`);
  const rotate = (seed % 15) - 7;
  const lift = ((seed >> 3) % 11) - 5;
  const themeFlavor = seed % 3;
  const glow = 20 + (seed % 16);

  let background = 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.88))';
  if (themeFlavor === 0) {
    background =
      'linear-gradient(180deg, color-mix(in srgb, var(--theme-primary-soft) 70%, white), rgba(255,255,255,0.9))';
  } else if (themeFlavor === 1) {
    background =
      'linear-gradient(180deg, color-mix(in srgb, rgba(var(--theme-secondary-rgb),0.25) 36%, white), rgba(255,255,255,0.9))';
  } else {
    background =
      'linear-gradient(180deg, color-mix(in srgb, rgba(var(--theme-tertiary-rgb),0.24) 36%, white), rgba(255,255,255,0.9))';
  }

  return {
    transform: `rotate(${rotate}deg) translateY(${lift}px)`,
    background,
    boxShadow: `0 14px ${glow}px rgba(var(--theme-primary-rgb), 0.16)`,
  };
}

function getPinStyle(id: string, index: number): CSSProperties {
  const seed = hashSeed(`pin-${id}-${index}`);
  if (seed % 3 === 0) {
    return { background: 'rgba(var(--theme-primary-rgb),0.92)' };
  }
  if (seed % 3 === 1) {
    return { background: 'rgba(var(--theme-secondary-rgb),0.88)' };
  }
  return { background: 'rgba(var(--theme-tertiary-rgb),0.88)' };
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
      toast.error('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u7559\u8a00');
      navigate('/login');
      return;
    }
    if (!content.trim()) {
      toast.error('\u8bf7\u5199\u4e00\u70b9\u7559\u8a00\u5185\u5bb9');
      return;
    }

    try {
      setSubmitting(true);
      await createGuestbookMessage({ content: content.trim() });
      toast.success('\u7559\u8a00\u5df2\u4e0a\u5899\uff0c\u6b22\u8fce\u5e38\u6765');
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
        toast.success('\u7559\u8a00\u5df2\u5220\u9664');
      } catch {
        // request.ts handles toast globally
      } finally {
        setDeletingId('');
      }
    };

    openConfirmToast({
      title: '\u786e\u8ba4\u5220\u9664\u8fd9\u6761\u7559\u8a00\uff1f',
      description: '\u5220\u9664\u540e\u4e0d\u53ef\u6062\u590d',
      confirmText: '\u786e\u8ba4\u5220\u9664',
      cancelText: '\u53d6\u6d88',
      confirmVariant: 'danger',
      onConfirm: runDelete,
    });
  };

  const handleTogglePin = async (item: GuestbookMessage) => {
    if (pinningId) return;
    try {
      setPinningId(item.id);
      await updateGuestbookMessagePin(item.id, !item.isPinned);
      toast.success(
        item.isPinned ? '\u5df2\u53d6\u6d88\u7f6e\u9876' : '\u5df2\u7f6e\u9876\u5230\u9876\u90e8',
      );
      setPage(1);
    } catch {
      // request.ts handles toast globally
    } finally {
      setPinningId('');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)]" style={PAGE_BACKGROUND}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section
          className="relative overflow-hidden rounded-[34px] border border-theme-shell-border bg-white/68 p-4 shadow-[0_24px_56px_rgba(var(--theme-primary-rgb),0.14)] backdrop-blur-md sm:p-6"
          style={{ perspective: '1400px' }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-75"
              style={{
                background:
                  'radial-gradient(circle at 15% 18%, rgba(var(--theme-secondary-rgb), 0.16), transparent 24%), radial-gradient(circle at 83% 20%, rgba(var(--theme-tertiary-rgb), 0.16), transparent 22%), radial-gradient(circle at 48% 84%, rgba(var(--theme-primary-rgb), 0.14), transparent 28%)',
              }}
            />
            <div
              className="absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)',
                backgroundSize: '32px 32px',
              }}
            />
          </div>

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="relative h-60 w-60 opacity-70 [transform-style:preserve-3d] [transform:rotateX(68deg)_rotateZ(22deg)]"
              style={{ transformOrigin: 'center center' }}
            >
              <div className="absolute inset-0 rounded-[34px] border border-white/45 bg-white/8 shadow-[0_0_48px_rgba(var(--theme-primary-rgb),0.24)] animate-spin [animation-duration:18s]" />
              <div className="absolute inset-9 rounded-[28px] border border-theme-soft-strong bg-theme-soft/25 shadow-[0_0_36px_rgba(var(--theme-primary-rgb),0.20)] animate-spin [animation-duration:12s] [animation-direction:reverse]" />
              <div className="absolute inset-[34%] rounded-2xl border border-white/80 bg-white/65 shadow-[0_0_36px_rgba(var(--theme-primary-rgb),0.34)]" />
            </div>
          </div>

          <div className="relative z-20 mx-auto max-w-3xl rounded-[28px] border border-white/55 bg-white/76 p-4 shadow-[0_20px_44px_rgba(var(--theme-primary-rgb),0.16)] backdrop-blur-lg sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h1 className="inline-flex items-center gap-2 text-lg font-semibold text-slate-900 sm:text-xl">
                <MessageCircleHeart className="h-5 w-5 text-theme-primary" />
                {'\u9177\u70ab\u7559\u8a00\u677f'}
              </h1>
              <span className="rounded-full border border-theme-soft-strong bg-theme-soft px-3 py-1 text-xs font-medium text-theme-primary">
                {'\u5df2\u4e0a\u5899'} {total} {'\u6761'}
              </span>
            </div>

            <p className="mb-3 text-xs leading-5 text-slate-500">
              {
                '\u8fd9\u662f\u4f60\u7684\u7075\u611f\u677f\uff0c\u8f93\u5165\u5185\u5bb9\u540e\u4f1a\u76f4\u63a5\u8d34\u5230\u677f\u9762\u4e0a\u3002\u7559\u8a00\u81ea\u52a8\u4f7f\u7528\u5f53\u524d\u8d26\u53f7\u5934\u50cf\u548c\u6635\u79f0\u3002'
              }
            </p>

            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">{'\u7559\u8a00\u5185\u5bb9'}</span>
                <span className={contentCount > 450 ? 'text-amber-600' : 'text-slate-400'}>
                  {contentCount}/500
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={500}
                rows={4}
                className="w-full rounded-2xl border border-theme-border bg-white/92 px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none transition focus:border-theme-soft-strong focus:ring-2 focus:ring-theme-soft"
                placeholder={
                  '\u5199\u70b9\u4ec0\u4e48\u8d34\u4e0a\u6765\uff0c\u6bd4\u5982\u6700\u8fd1\u5728\u505a\u7684\u4f5c\u54c1\u3001\u7075\u611f\u6216\u4e00\u53e5\u8bdd...'
                }
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {isAuthenticated
                  ? '\u5df2\u767b\u5f55\uff0c\u53ef\u76f4\u63a5\u53d1\u5e03'
                  : '\u767b\u5f55\u540e\u53ef\u53d1\u5e03\u7559\u8a00'}
              </span>
              <div className="flex items-center gap-2">
                {!isAuthenticated ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/login')}
                    className="rounded-xl border-theme-soft-strong bg-white/78 px-4 text-theme-primary hover:bg-theme-soft"
                  >
                    {'\u53bb\u767b\u5f55'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="theme-btn-primary rounded-xl px-5 text-sm font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {'\u4e0a\u5899\u4e2d...'}
                    </>
                  ) : (
                    <>
                      <SendHorizontal className="mr-2 h-4 w-4" />
                      {'\u8d34\u4e0a\u7559\u8a00'}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-5 min-h-[520px]">
            <BoxLoadingOverlay
              show={loading}
              title={'\u7559\u8a00\u677f\u52a0\u8f7d\u4e2d...'}
              hint={'\u6b63\u5728\u6302\u8d77\u6240\u6709\u4fbf\u7b7e'}
              className="rounded-[24px]"
            />

            {loading ? (
              <div className="grid gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-theme-border bg-white/88 p-4 shadow-[0_12px_24px_rgba(var(--theme-primary-rgb),0.12)]"
                  >
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
                title={'\u7559\u8a00\u677f\u8fd8\u662f\u7a7a\u7684'}
                description={
                  '\u5199\u4e0b\u7b2c\u4e00\u6761\u7559\u8a00\uff0c\u8ba9\u8fd9\u5757\u677f\u5b50\u4eae\u8d77\u6765\u3002'
                }
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
                        className="relative rounded-2xl border border-white/66 p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]"
                      >
                        <span
                          style={getPinStyle(item.id, index)}
                          className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-white/75 shadow-[0_3px_10px_rgba(0,0,0,0.18)]"
                        />
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Avatar className="h-9 w-9 border border-white/70">
                              <AvatarImage src={item.avatar} alt={item.nickname} />
                              <AvatarFallback className="theme-avatar-fallback text-xs font-semibold text-white">
                                {(item.nickname?.[0] || 'V').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {item.nickname}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {formatMessageTime(item.createdAt)}
                              </p>
                            </div>
                          </div>
                          {item.isPinned ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-theme-soft px-2 py-0.5 text-[11px] font-medium text-theme-primary">
                              <Pin className="h-3 w-3" />
                              {'\u7f6e\u9876'}
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                          {item.content}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-theme-soft-strong bg-white/72 px-2 py-0.5 text-[11px] text-theme-primary">
                            <Sparkles className="h-3 w-3" />
                            {'\u4fbf\u7b7e\u6a21\u5f0f'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {canPin ? (
                              <button
                                type="button"
                                onClick={() => void handleTogglePin(item)}
                                disabled={pinningId === item.id}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                  item.isPinned
                                    ? 'border-theme-soft-strong bg-theme-soft text-theme-primary hover:bg-theme-soft/80'
                                    : 'border-sky-200 bg-sky-50/80 text-sky-700 hover:bg-sky-100'
                                }`}
                              >
                                {pinningId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Pin className="h-3.5 w-3.5" />
                                )}
                                {item.isPinned ? '\u53d6\u6d88\u7f6e\u9876' : '\u7f6e\u9876'}
                              </button>
                            ) : null}

                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                disabled={deletingId === item.id}
                                className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50/80 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                {'\u5220\u9664'}
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
                      className="rounded-xl border-theme-soft-strong bg-white/82 px-8 text-theme-primary hover:bg-theme-soft"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {'\u52a0\u8f7d\u4e2d...'}
                        </>
                      ) : (
                        `\u518d\u8d34\u4e00\u4e9b\uff08\u5269\u4f59 ${remainingCount} \u6761\uff09`
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
