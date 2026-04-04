import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronLeftCircle,
  ChevronRightCircle,
  Clock,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { PostDetail } from '@/api/blog';
import { getAdminPostDetail, getPostDetailById } from '@/api/blog';
import { MarkdownContent, TableOfContents } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import { extractToc, formatDate, renderMarkdownWithAnchors, type TocItem } from '@/utils/blog';
import { DefaultBlogCover } from './components/DefaultBlogCover';

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

export default function BlogPost() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [imagePageIndex, setImagePageIndex] = useState(0);

  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo || '/blog';
  const returnLabel =
    (location.state as { returnLabel?: string } | null)?.returnLabel || '返回博客列表';

  const handleReturn = useCallback(() => {
    if (window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(returnTo);
  }, [navigate, returnTo]);

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
      } catch (error) {
        console.error('Failed to load post:', error);
        setPost(null);
      } finally {
        setLoading(false);
      }
    },
    [user?.role],
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

  const pages = useMemo(() => {
    if (!imageTextData?.pages?.length) return null;
    return imageTextData.pages
      .map((item) => {
        if (typeof item === 'string') return item;
        return item?.text || '';
      })
      .filter(Boolean);
  }, [imageTextData]);

  const imageUrls = useMemo(() => {
    if (!post || post.postType !== 'image_text') return [];
    if (imageTextData?.images?.length) return imageTextData.images;
    return extractMarkdownImageUrls(post.content || '');
  }, [post, imageTextData]);

  const pageCount = imageUrls.length > 0 ? imageUrls.length : pages?.length || 0;

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

  const processedContent = useMemo(() => {
    if (!post) return '';
    return renderMarkdownWithAnchors(post.content || post.htmlContent || '');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-3/4 rounded bg-muted" />
            <div className="h-4 w-1/2 rounded bg-muted" />
            <div className="mt-8 h-64 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-foreground">文章未找到</h1>
          <p className="mb-6 text-muted-foreground">你访问的文章不存在，或当前账号没有权限访问。</p>
          <Button onClick={handleReturn}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {returnLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 via-background to-background">
      <div
        data-blog-post-nav
        className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur"
      >
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={handleReturn}
            className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {returnLabel}
          </button>
        </div>
      </div>

      {post.postType === 'image_text' && pageCount > 0 ? (
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
          <main className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm lg:p-6">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5">
                <div className="h-7 w-7 overflow-hidden rounded-full bg-slate-200">
                  {post.author?.avatar ? (
                    <img
                      src={post.author.avatar}
                      alt={post.author.nickname || 'author'}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <span className="font-medium text-foreground">
                  {post.author?.nickname || '创作者'}
                </span>
              </div>
              {post.group && (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                  {post.group.name}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(post.publishedAt || post.createdAt)}
              </span>
              {pageCount > 1 && (
                <span className="text-xs text-muted-foreground">
                  {imagePageIndex + 1}/{pageCount}
                </span>
              )}
            </div>
            <section className="rounded-2xl bg-[#f3f4f6] p-4 sm:p-6">
              <div className="mx-auto flex max-w-[760px] items-center justify-center gap-4">
                {pageCount > 1 && (
                  <button
                    type="button"
                    onClick={goPrevPage}
                    className="text-slate-400 transition hover:text-slate-700"
                  >
                    <ChevronLeftCircle className="h-9 w-9" />
                  </button>
                )}

                {imageUrls.length > 0 ? (
                  <div className="relative h-[720px] w-[460px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0">
                    <img
                      src={imageUrls[imagePageIndex]}
                      alt={`图文第 ${imagePageIndex + 1} 页`}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="relative h-[720px] w-[460px] overflow-hidden rounded-2xl border border-[#e1d7bc] bg-[#f8f5eb] p-6">
                    <div className="absolute left-5 top-4 text-xs text-black/35">
                      {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                    {!!imageTextData?.stickerEmoji && (
                      <div className="absolute right-7 top-7 text-4xl">
                        {imageTextData.stickerEmoji}
                      </div>
                    )}
                    <div
                      className="mt-24 whitespace-pre-wrap text-[42px] font-semibold text-[#4e4537]"
                      style={{
                        fontFamily:
                          imageTextData?.style?.fontFamily || '"STSong", "Songti SC", serif',
                        lineHeight: imageTextData?.style?.lineHeight || '1.58',
                      }}
                    >
                      {pages?.[imagePageIndex] || ''}
                    </div>
                  </div>
                )}

                {pageCount > 1 && (
                  <button
                    type="button"
                    onClick={goNextPage}
                    className="text-slate-400 transition hover:text-slate-700"
                  >
                    <ChevronRightCircle className="h-9 w-9" />
                  </button>
                )}
              </div>

              {pageCount > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  {Array.from({ length: pageCount }).map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setImagePageIndex(index)}
                      className={`h-2.5 rounded-full transition ${
                        imagePageIndex === index ? 'w-7 bg-violet-500' : 'w-2.5 bg-slate-300'
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>
          </main>
        </div>
      ) : (
        <>
          <header className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm sm:p-10">
              {post.group && (
                <Link
                  to={`/blog?groupId=${encodeURIComponent(post.group.id)}`}
                  className="mb-5 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {post.group.name}
                </Link>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <h1 className="max-w-4xl text-3xl font-bold leading-tight text-foreground sm:text-5xl">
                  {post.title}
                </h1>
                {canEditBlog && (
                  <Link to={`/my-space/blog-edit/${post.id}`}>
                    <Button variant="outline" className="rounded-xl">
                      编辑文章
                    </Button>
                  </Link>
                )}
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-border/60">
                {post.cover ? (
                  <img
                    src={post.cover}
                    alt={post.title}
                    className="h-72 w-full object-cover sm:h-80"
                  />
                ) : (
                  <DefaultBlogCover className="h-72 sm:h-80" />
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                {post.author?.nickname && (
                  <div className="inline-flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>{post.author.nickname}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <time>{formatDate(post.publishedAt || post.createdAt)}</time>
                </div>
                <div className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>
                    预计阅读 {Math.max(1, Math.ceil((post.content || '').length / 500))} 分钟
                  </span>
                </div>
                {post.viewCount > 0 && <span>{post.viewCount} 次阅读</span>}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-8 lg:flex-row">
              {toc.length > 0 && (
                <aside className="hidden w-64 shrink-0 lg:block">
                  <div className="sticky top-24 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                    <TableOfContents toc={toc} />
                  </div>
                </aside>
              )}

              <main className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-card p-6 shadow-sm sm:p-10">
                <MarkdownContent content={processedContent} />
                <div className="mt-12 border-t border-border pt-6">
                  <Button variant="ghost" className="gap-2" onClick={handleReturn}>
                    <ArrowLeft className="h-4 w-4" />
                    {returnLabel}
                  </Button>
                </div>
              </main>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
