import { ArrowRight, FileText, PenLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAdminPosts, type Post } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 20;
const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已发布' },
] as const;

function parsePage(value: string | null) {
  const page = Number(value || 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export default function StudioArticles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get('page'));
  const status = searchParams.get('status') || 'all';
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
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
          <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight">文章草稿</h1>
          <p className="mt-3 text-sm text-muted-foreground">在一个列表查看草稿和已发布文章。</p>
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
              return (
                <Link
                  key={post.id}
                  to={editPath}
                  className="group grid gap-3 px-2 py-5 transition-colors hover:bg-muted/40 sm:grid-cols-[7rem_minmax(0,1fr)_9rem_auto] sm:items-center sm:px-4"
                >
                  <span className="text-xs text-muted-foreground">
                    {post.group?.name || '未设专栏'}
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-base font-medium">
                      {post.title || '未命名文章'}
                    </strong>
                    {post.excerpt ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{post.excerpt}</p>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {post.status === 'published'
                      ? '已发布'
                      : post.status === 'archived'
                        ? '已归档'
                        : '草稿'}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
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
    </div>
  );
}
