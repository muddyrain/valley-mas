import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Grid2X2,
  MessageCircle,
  PencilLine,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  createPostComment,
  deletePostComment,
  getAdminPostDetail,
  getPostComments,
  getPostDetailById,
  type PostComment,
  type PostDetail,
} from '@/api/blog';
import { MarkdownContent, PostComments, TableOfContents } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  createPlainTextExcerpt,
  extractToc,
  formatDate,
  renderMarkdownWithAnchors,
  type TocItem,
} from '@/utils/blog';
import { DefaultBlogCover } from '../components/DefaultBlogCover';

type ImageTextPayload = {
  images?: string[];
  pages?: Array<string | { text?: string; imageUrl?: string }>;
  stickerEmoji?: string;
  style?: {
    templateKey?: string;
    textClass?: string;
    fontFamily?: string;
    lineHeight?: string;
  };
};

const visibilityLabelMap: Record<string, string> = {
  public: '公开可见',
  shared: '口令访问',
  private: '仅自己可见',
};

function extractMarkdownImageUrls(content: string) {
  if (!content) return [];
  const matcher = /!\[[^\]]*]\(([^)]+)\)/g;
  const urls: string[] = [];
  let match = matcher.exec(content);
  while (match) {
    const url = (match[1] || '').trim();
    if (url) urls.push(url);
    match = matcher.exec(content);
  }
  return urls;
}

function getReadingMinutes(content: string) {
  return Math.max(1, Math.ceil((content || '').length / 500));
}

export default function BlogPost() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [imagePageIndex, setImagePageIndex] = useState(0);

  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/blog';
  const returnLabel =
    (location.state as { returnLabel?: string } | null)?.returnLabel || '返回内容列表';

  const handleReturn = useCallback(() => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(returnTo);
  }, [navigate, returnTo]);

  const loadComments = useCallback(async (postId: string) => {
    setCommentLoading(true);
    try {
      const data = await getPostComments(postId, { suppressErrorToast: true });
      setComments(data.list || []);
      setCommentTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to load comments:', error);
      setComments([]);
      setCommentTotal(0);
    } finally {
      setCommentLoading(false);
    }
  }, []);

  const loadPost = useCallback(
    async (postId: string) => {
      setLoading(true);
      try {
        let data: PostDetail;
        try {
          data = await getPostDetailById(postId, { suppressErrorToast: true });
        } catch (error) {
          if (user?.role !== 'creator') throw error;
          data = await getAdminPostDetail(postId, { suppressErrorToast: true });
        }
        setPost(data);
        setToc(extractToc(data.content || ''));
        setImagePageIndex(0);
        void loadComments(postId);
      } catch (error) {
        console.error('Failed to load post:', error);
        setPost(null);
      } finally {
        setLoading(false);
      }
    },
    [loadComments, user?.role],
  );

  useEffect(() => {
    if (!id) return;
    void loadPost(id);
  }, [id, loadPost]);

  const imageTextData = useMemo<ImageTextPayload | null>(() => {
    if (!post || post.postType !== 'image_text') return null;
    const raw = post.imageTextData || post.templateData;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ImageTextPayload;
    } catch {
      return null;
    }
  }, [post]);

  const pageTexts = useMemo(() => {
    if (!imageTextData?.pages?.length) return [];
    return imageTextData.pages
      .map((item) => (typeof item === 'string' ? item : item?.text || ''))
      .filter(Boolean);
  }, [imageTextData]);

  const imageUrls = useMemo(() => {
    if (!post || post.postType !== 'image_text') return [];
    if (imageTextData?.images?.length) return imageTextData.images;
    return extractMarkdownImageUrls(post.content || '');
  }, [imageTextData, post]);

  const pageCount = imageUrls.length > 0 ? imageUrls.length : pageTexts.length;
  const currentPageText = pageTexts[imagePageIndex] || '';
  const processedContent = useMemo(() => {
    if (!post) return '';
    return renderMarkdownWithAnchors(post.content || post.htmlContent || '');
  }, [post]);
  const excerpt = useMemo(() => {
    if (!post) return '';
    const rawExcerpt = post.excerpt?.trim() || post.content?.trim() || '';
    return createPlainTextExcerpt(rawExcerpt, 180);
  }, [post]);

  const canEditBlog = useMemo(() => {
    if (!post || post.postType !== 'blog') return false;
    return Boolean(user?.id && post.author?.id && user.id === post.author.id);
  }, [post, user?.id]);

  const goPrevPage = () => {
    if (pageCount <= 1) return;
    setImagePageIndex((prev) => (prev - 1 + pageCount) % pageCount);
  };

  const goNextPage = () => {
    if (pageCount <= 1) return;
    setImagePageIndex((prev) => (prev + 1) % pageCount);
  };

  const handleCommentSubmit = async (content: string) => {
    if (!post) return;
    setCommentSubmitting(true);
    try {
      const created = await createPostComment(post.id, { content });
      setComments((prev) => [...prev, created]);
      setCommentTotal((prev) => prev + 1);
      toast.success('评论已发布');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleCommentDelete = async (commentId: string) => {
    await deletePostComment(commentId);
    setComments((prev) => prev.filter((item) => item.id !== commentId));
    setCommentTotal((prev) => Math.max(0, prev - 1));
    toast.success('评论已删除');
  };

  useEffect(() => {
    if (pageCount <= 1) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setImagePageIndex((prev) => (prev - 1 + pageCount) % pageCount);
      } else if (event.key === 'ArrowRight') {
        setImagePageIndex((prev) => (prev + 1) % pageCount);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pageCount]);

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--theme-page-start)' }}>
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_360px]">
            <div className="h-[72vh] animate-pulse rounded-[36px] bg-white/80" />
            <div className="space-y-4">
              <div className="h-36 animate-pulse rounded-[28px] bg-white/80" />
              <div className="h-[48vh] animate-pulse rounded-[28px] bg-white/80" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-4"
        style={{ background: 'var(--theme-page-start)' }}
      >
        <div className="theme-panel-shell max-w-md rounded-[28px] border bg-white px-6 py-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">内容暂时无法访问</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            这篇内容可能已被删除，或当前账号没有访问权限。
          </p>
          <Button onClick={handleReturn} className="theme-btn-primary mt-6 rounded-full px-5">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {returnLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (post.postType === 'image_text') {
    return (
      <div
        className="min-h-screen"
        style={{
          background: `linear-gradient(180deg, var(--theme-page-start) 0%, var(--theme-page-mid) 52%, #ffffff 100%)`,
        }}
      >
        <div className="theme-header sticky top-0 z-40 border-b bg-white/88 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={handleReturn}
              className="border-theme-soft-strong inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {returnLabel}
            </button>

            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="rounded-full bg-white px-3 py-1.5">
                {visibilityLabelMap[post.visibility || 'public'] || '公开可见'}
              </span>
              {pageCount > 0 && (
                <span className="rounded-full bg-white px-3 py-1.5">共 {pageCount} 页</span>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          <section className="theme-hero-shell relative mb-8 overflow-hidden rounded-[34px] border px-6 py-6 sm:px-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(251,191,36,0.12),transparent_26%),radial-gradient(circle_at_86%_18%,rgba(96,165,250,0.14),transparent_24%)]" />
            <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="theme-eyebrow inline-flex items-center gap-2 rounded-full border bg-white/82 px-4 py-1.5 text-[11px] tracking-[0.28em] uppercase shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)] backdrop-blur">
                  图文详情
                </div>
                <div className="space-y-2">
                  <h1 className="text-[34px] font-semibold tracking-[-0.04em] text-slate-950 md:text-[42px]">
                    {post.title}
                  </h1>
                  {excerpt ? (
                    <p className="max-w-3xl text-[15px] leading-8 text-slate-500 md:text-base">
                      {excerpt}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
                  {visibilityLabelMap[post.visibility || 'public'] || '公开可见'}
                </span>
                <span className="rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_rgba(148,163,184,0.08)]">
                  共 {pageCount || 1} 页
                </span>
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <section className="theme-section-shell rounded-[36px] border p-4 sm:p-5">
              <div className="rounded-[30px] bg-white/72 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-slate-500">
                    <Grid2X2 className="h-3.5 w-3.5" />
                    图文详情
                  </div>
                  {pageCount > 1 && (
                    <div className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-500">
                      第 {imagePageIndex + 1} / {pageCount} 页
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[84px_minmax(0,1fr)]">
                  {pageCount > 1 && (
                    <div className="order-2 flex gap-3 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:overflow-visible lg:pb-0">
                      {Array.from({ length: pageCount }).map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setImagePageIndex(index)}
                          className={`group flex min-w-[74px] flex-col items-center gap-2 rounded-[26px] border px-2 py-3 transition ${
                            imagePageIndex === index
                              ? 'border-[#f39b48] bg-white shadow-[0_14px_36px_rgba(243,155,72,0.2)]'
                              : 'border-white/60 bg-white/70 hover:border-[#f4d5ab]'
                          }`}
                        >
                          <div className="flex h-[92px] w-[54px] items-center justify-center overflow-hidden rounded-[18px] bg-[#fbf7ef]">
                            {imageUrls[index] ? (
                              <img
                                src={imageUrls[index]}
                                alt={`图文第 ${index + 1} 页`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="line-clamp-4 px-2 text-center text-[10px] leading-4 text-slate-500">
                                {pageTexts[index] || `第 ${index + 1} 页`}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-slate-500">
                            P{index + 1}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="order-1 lg:order-2">
                    <div className="relative flex min-h-[70vh] items-center justify-center rounded-[32px] bg-[linear-gradient(180deg,#fbf8f0_0%,#f7f1e5_100%)] p-4 sm:p-6">
                      {pageCount > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={goPrevPage}
                            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/80 bg-white/90 p-2 text-slate-500 shadow-sm transition hover:text-slate-900"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={goNextPage}
                            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/80 bg-white/90 p-2 text-slate-500 shadow-sm transition hover:text-slate-900"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}

                      {imageUrls[imagePageIndex] ? (
                        <div className="w-full max-w-[740px] overflow-hidden rounded-[28px] border border-[#e7dbc5] bg-white shadow-[0_26px_80px_rgba(100,77,38,0.12)]">
                          <img
                            src={imageUrls[imagePageIndex]}
                            alt={`${post.title} 第 ${imagePageIndex + 1} 页`}
                            className="h-auto w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[72vh] w-full max-w-[740px] items-center justify-center rounded-[28px] border border-[#e7dbc5] bg-white px-10 text-center shadow-[0_26px_80px_rgba(100,77,38,0.12)]">
                          <p
                            className="whitespace-pre-wrap break-words text-[42px] font-semibold leading-[1.45] text-[#3f362b]"
                            style={{
                              fontFamily:
                                imageTextData?.style?.fontFamily || '"STSong", "Songti SC", serif',
                              lineHeight: imageTextData?.style?.lineHeight || '1.58',
                            }}
                          >
                            {currentPageText}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <section className="theme-panel-shell rounded-[30px] border p-6">
                <div className="bg-theme-soft text-theme-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
                  图文创作
                </div>
                <h1 className="mt-4 text-[30px] font-semibold leading-tight text-slate-900">
                  {post.title}
                </h1>
                {excerpt && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                    {excerpt}
                  </p>
                )}

                <div className="border-theme-soft-strong mt-6 grid gap-3 rounded-[22px] border bg-white/60 p-4 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{post.author?.nickname || '未署名创作者'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <span>{post.viewCount || 0} 次阅读</span>
                  </div>
                  {post.group && (
                    <div className="flex items-center gap-2">
                      <Grid2X2 className="h-4 w-4" />
                      <span>{post.group.name}</span>
                    </div>
                  )}
                </div>
              </section>

              <PostComments
                comments={comments}
                total={commentTotal}
                loading={commentLoading}
                submitting={commentSubmitting}
                onSubmit={handleCommentSubmit}
                onDelete={handleCommentDelete}
                ownerId={post.author?.id}
                title="图文评论"
                compact
              />
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: `linear-gradient(180deg, var(--theme-page-start) 0%, var(--theme-page-mid) 48%, #ffffff 100%)`,
      }}
    >
      <div className="theme-header sticky top-0 z-40 border-b bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={handleReturn}
            className="border-theme-soft-strong inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {returnLabel}
          </button>

          {canEditBlog && (
            <Link to={`/my-space/blog-edit/${post.id}`}>
              <Button
                variant="outline"
                className="border-theme-soft-strong hover:bg-theme-soft rounded-full border bg-white px-5 text-slate-700"
              >
                <PencilLine className="mr-2 h-4 w-4" />
                编辑博客
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <header className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <section className="theme-panel-shell rounded-[36px] border bg-white/92 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              {post.group && (
                <Link
                  to={`/blog?groupId=${encodeURIComponent(post.group.id)}`}
                  className="bg-theme-soft text-theme-primary rounded-full px-3 py-1 text-xs font-medium"
                >
                  {post.group.name}
                </Link>
              )}
              <span className="bg-theme-soft text-theme-primary rounded-full px-3 py-1 text-xs">
                {visibilityLabelMap[post.visibility || 'public'] || '公开可见'}
              </span>
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-slate-950 sm:text-5xl">
              {post.title}
            </h1>

            {excerpt && (
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                {excerpt}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-slate-500">
              {post.author?.nickname && (
                <div className="inline-flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{post.author.nickname}</span>
                </div>
              )}
              <div className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                <span>{formatDate(post.publishedAt || post.createdAt)}</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                <span>预计阅读 {getReadingMinutes(post.content || '')} 分钟</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{post.viewCount || 0} 次阅读</span>
              </div>
              <div className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>{commentTotal} 条评论</span>
              </div>
            </div>

            <div className="theme-panel-shell mt-8 overflow-hidden rounded-[28px] border">
              {post.cover ? (
                <img
                  src={post.cover}
                  alt={post.title}
                  className="h-64 w-full object-cover sm:h-80"
                />
              ) : (
                <DefaultBlogCover className="h-64 sm:h-80" />
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="theme-hero-shell overflow-hidden rounded-[30px] border p-6">
              <div className="text-sm font-medium text-slate-900">这篇文章讲什么</div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {excerpt || '这篇文章还没有补充摘要，可以直接从正文开始阅读。'}
              </p>
            </section>

            {toc.length > 0 && (
              <section className="theme-panel-shell rounded-[30px] border p-6">
                <div className="text-sm font-medium text-slate-900">目录导读</div>
                <div className="mt-4">
                  <TableOfContents toc={toc} />
                </div>
              </section>
            )}
          </aside>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="theme-panel-shell rounded-[36px] border bg-white/95 p-6 sm:p-10">
            <MarkdownContent content={processedContent} />
            <div className="border-theme-soft-strong mt-12 border-t pt-6">
              <Button
                variant="ghost"
                className="rounded-full px-0 text-slate-500 hover:bg-transparent hover:text-slate-900"
                onClick={handleReturn}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {returnLabel}
              </Button>
            </div>
          </main>

          <aside className="space-y-6">
            <PostComments
              comments={comments}
              total={commentTotal}
              loading={commentLoading}
              submitting={commentSubmitting}
              onSubmit={handleCommentSubmit}
              onDelete={handleCommentDelete}
              ownerId={post.author?.id}
              title="博客评论"
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
