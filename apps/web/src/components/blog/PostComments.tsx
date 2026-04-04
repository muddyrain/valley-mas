import { Loader2, MessageCircle, Send, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { PostComment } from '@/api/blog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatDate } from '@/utils/blog';

type PostCommentsProps = {
  comments: PostComment[];
  total: number;
  loading?: boolean;
  submitting?: boolean;
  onSubmit: (content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  ownerId?: string;
  title?: string;
  compact?: boolean;
};

export function PostComments({
  comments,
  total,
  loading = false,
  submitting = false,
  onSubmit,
  onDelete,
  ownerId,
  title = '评论',
  compact = false,
}: PostCommentsProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [draft, setDraft] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canPublish = draft.trim().length > 0 && !submitting;
  const emptyLabel = useMemo(
    () => (loading ? '评论加载中...' : '还没有评论，写下第一条想法吧。'),
    [loading],
  );

  const handleSubmit = async () => {
    const content = draft.trim();
    if (!content) {
      toast.error('先写点内容再发布评论吧');
      return;
    }
    await onSubmit(content);
    setDraft('');
  };

  const handleDelete = async (commentId: string) => {
    setDeletingId(commentId);
    try {
      await onDelete(commentId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section
      className={`rounded-[28px] border border-[#f0dcc2] bg-white/92 shadow-[0_22px_60px_rgba(236,206,162,0.2)] ${compact ? 'p-5' : 'p-6 sm:p-7'}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#fff3e4] px-3 py-1 text-xs font-medium text-[#f06b14]">
            <MessageCircle className="h-3.5 w-3.5" />
            {title}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">{total} 条评论</h3>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200/80 bg-slate-50/70 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={isAuthenticated ? '写下你的想法...' : '登录后可以参与评论'}
          disabled={!isAuthenticated || submitting}
          className="min-h-[108px] w-full resize-none border-0 bg-transparent text-sm leading-7 text-slate-700 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
        />
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
          <span className="text-xs text-slate-400">支持纯文本评论，适合记录想法和交流反馈。</span>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!isAuthenticated || !canPublish}
            className="rounded-full bg-[#ff7a18] px-5 text-white hover:bg-[#f26d0a]"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            发布评论
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {comments.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
            {emptyLabel}
          </div>
        ) : (
          comments.map((comment) => {
            const canDelete =
              Boolean(user?.id) &&
              (user?.id === comment.userId || user?.id === ownerId || user?.role === 'admin');

            return (
              <article
                key={comment.id}
                className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200">
                      {comment.author?.avatar ? (
                        <img
                          src={comment.author.avatar}
                          alt={comment.author.nickname || '评论用户'}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-slate-900">
                          {comment.author?.nickname || '匿名用户'}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatDate(comment.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                        {comment.content}
                      </p>
                    </div>
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      disabled={deletingId === comment.id}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-60"
                    >
                      {deletingId === comment.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      删除
                    </button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
