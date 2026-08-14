import { FileText, Loader2, Pencil, PenLine, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { deletePost, getAdminPosts, type Post } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';

const PAGE_SIZE = 20;
const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
  { value: 'archived', label: '已归档' },
] as const;

function parsePage(value: string | null) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatUpdatedAt(value?: string) {
  if (!value) return '时间待补充';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function getPostStatusLabel(status?: Post['status']) {
  if (status === 'published') return '已发布';
  if (status === 'archived') return '已归档';
  return '草稿';
}

export default function StudioArticles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const status = searchParams.get('status') || 'all';
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const loadPosts = useCallback(() => {
    setLoading(true);
    setFailed(false);
    return getAdminPosts({
      page,
      pageSize: PAGE_SIZE,
      ...(status !== 'all' ? { status } : {}),
      sort: 'created',
    })
      .then((result) => {
        setPosts(result.list || []);
        setTotal(result.total || 0);
      })
      .catch(() => {
        setPosts([]);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (!loading && page > totalPages) {
      const next = new URLSearchParams(searchParams);
      next.set('page', String(totalPages));
      setSearchParams(next, { replace: true });
    }
  }, [loading, page, searchParams, setSearchParams, totalPages]);

  const updateQuery = (updates: { page?: number; status?: string }) => {
    const next = new URLSearchParams(searchParams);
    if (updates.status !== undefined) {
      if (updates.status === 'all') next.delete('status');
      else next.set('status', updates.status);
      next.delete('page');
    }
    if (updates.page !== undefined) {
      if (updates.page <= 1) next.delete('page');
      else next.set('page', String(updates.page));
    }
    setSearchParams(next);
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    try {
      setDeleting(true);
      await deletePost(deleteTarget.id);
      toast.success('文章已永久删除');
      setDeleteTarget(null);
      if (posts.length === 1 && page > 1) {
        updateQuery({ page: page - 1 });
      } else {
        await loadPosts();
      }
    } catch {
      toast.error('暂时无法删除文章，请稍后再试');
    } finally {
      setDeleting(false);
    }
  };

  const statusCounts = useMemo(
    () =>
      posts.reduce<Record<string, number>>((counts, post) => {
        const key = post.status || 'draft';
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {}),
    [posts],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:px-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
        <div>
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground">
            ARTICLE LIBRARY
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">文章库</h1>
          <p className="mt-3 text-sm text-muted-foreground">整理、编辑和发布你的全部文章。</p>
        </div>
        <Button render={<Link to="/studio/articles/new" />} className="gap-2">
          <PenLine className="size-4" /> 写文章
        </Button>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <label className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">状态</span>
          <select
            value={status}
            onChange={(event) => updateQuery({ status: event.target.value })}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-muted-foreground">{total} 篇</span>
      </div>

      <section className="relative mt-5 min-h-64">
        <BoxLoadingOverlay show={loading} title="正在读取文章" />
        {!loading && failed ? (
          <div className="flex min-h-52 flex-col items-center justify-center border border-border text-sm text-muted-foreground">
            <p>暂时无法读取文章。</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void loadPosts()}
            >
              重新加载
            </Button>
          </div>
        ) : !loading && posts.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center border border-dashed border-border text-center">
            <FileText className="size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">当前状态下没有文章</p>
            <Link
              to="/studio/articles/new"
              className="mt-2 text-sm text-muted-foreground hover:text-foreground"
            >
              写一篇新文章
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {posts.map((post) => {
              const editPath =
                post.postType === 'image_text'
                  ? `/my-space/image-text-edit/${post.id}`
                  : `/studio/articles/${post.id}`;
              const title = post.title || '未命名文章';
              return (
                <article
                  key={post.id}
                  className="group grid gap-4 px-2 py-4 transition-colors hover:bg-muted/35 sm:grid-cols-[8.5rem_minmax(0,1fr)_7rem_auto] sm:items-center sm:px-4"
                >
                  <Link
                    to={editPath}
                    className="relative block aspect-[16/10] overflow-hidden rounded-md border border-border bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`编辑${title}`}
                  >
                    {post.cover ? (
                      <img
                        src={post.cover}
                        alt={`${title}封面`}
                        className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.025]"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-muted to-background px-2 text-center">
                        <span className="font-serif text-2xl text-foreground/55" aria-hidden="true">
                          {title.slice(0, 1)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">未设置封面</span>
                      </span>
                    )}
                  </Link>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {post.group?.name || '未设专栏'} · 更新于{' '}
                      {formatUpdatedAt(post.updatedAt || post.createdAt)}
                    </p>
                    <h2 className="mt-1.5 truncate text-base font-semibold">
                      <Link to={editPath} className="hover:underline hover:underline-offset-4">
                        {title}
                      </Link>
                    </h2>
                    {post.excerpt ? (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {post.excerpt}
                      </p>
                    ) : null}
                  </div>
                  <span className="w-fit rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    {getPostStatusLabel(post.status)}
                  </span>
                  <div className="flex items-center gap-1 sm:justify-end">
                    <Link
                      to={editPath}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <Pencil className="size-3.5" /> 编辑
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`永久删除${title}`}
                      onClick={() => setDeleteTarget(post)}
                    >
                      <Trash2 className="size-3.5" /> 删除
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {!loading && totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateQuery({ page: page - 1 })}
          >
            上一页
          </Button>
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => updateQuery({ page: page + 1 })}
          >
            下一页
          </Button>
        </div>
      ) : null}

      <span className="sr-only">
        本页草稿 {statusCounts.draft || 0} 篇，已发布 {statusCounts.published || 0} 篇
      </span>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除这篇文章？</AlertDialogTitle>
            <AlertDialogDescription>
              文章及关联封面将永久删除，无法恢复。
              {deleteTarget?.title ? ` 即将删除“${deleteTarget.title}”。` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              {deleting ? '正在删除' : '永久删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
