import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Grid2X2,
  List,
  Loader2,
  MessageCircle,
  PencilLine,
  Sparkles,
  User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  askBlogPost,
  type BlogAskResponse,
  type BlogReaderGuideResponse,
  createPostComment,
  deletePostComment,
  generateBlogReaderGuide,
  getAdminPostDetail,
  getPostComments,
  getPostDetailById,
  getPosts,
  type Post,
  type PostComment,
  type PostDetail,
} from '@/api/blog';
import { BlogCoverMedia, MarkdownContent, PostComments, TableOfContents } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  createPlainTextExcerpt,
  extractToc,
  formatDate,
  renderMarkdownWithAnchors,
  type TocItem,
} from '@/utils/blog';

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
  const [readProgress, setReadProgress] = useState(0);
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [adjacentPosts, setAdjacentPosts] = useState<{ prev: Post | null; next: Post | null }>({
    prev: null,
    next: null,
  });
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const [activeTocId, setActiveTocId] = useState('');
  const [statusTocId, setStatusTocId] = useState('');
  const [aiGuide, setAIGuide] = useState<BlogReaderGuideResponse | null>(null);
  const [aiGuideLoading, setAIGuideLoading] = useState(false);
  const [aiGuideError, setAIGuideError] = useState('');
  const [askQuestion, setAskQuestion] = useState('');
  const [askResult, setAskResult] = useState<BlogAskResponse | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askError, setAskError] = useState('');
  const articleSectionRef = useRef<HTMLElement | null>(null);
  const commentSectionRef = useRef<HTMLDivElement | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const progressRef = useRef(0);

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

  const scrollToSection = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    const offsetTop = target.getBoundingClientRect().top + window.scrollY - 92;
    window.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
  }, []);

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

  useEffect(() => {
    setMobileTocOpen(false);
    setActiveTocId('');
    setStatusTocId('');
    setAIGuide(null);
    setAIGuideError('');
    setAskQuestion('');
    setAskResult(null);
    setAskError('');
  }, [id, toc.length]);

  useEffect(() => {
    if (!activeTocId) {
      setStatusTocId('');
      return;
    }
    const timer = window.setTimeout(() => {
      setStatusTocId(activeTocId);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeTocId]);

  useEffect(() => {
    if (!mobileTocOpen) return;
    const originOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originOverflow;
    };
  }, [mobileTocOpen]);

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
  const totalReadMinutes = useMemo(
    () => (post && post.postType === 'blog' ? getReadingMinutes(post.content || '') : 0),
    [post],
  );
  const remainingReadMinutes = useMemo(() => {
    if (!totalReadMinutes) return 0;
    return Math.max(0, Math.ceil(totalReadMinutes * (1 - readProgress / 100)));
  }, [readProgress, totalReadMinutes]);
  const activeTocTitle = useMemo(
    () => toc.find((item) => item.id === statusTocId)?.text || '',
    [statusTocId, toc],
  );
  const scrollStatusTip = useMemo(() => {
    if (!totalReadMinutes) return '';
    if (readProgress < 10) return '刚进入正文，建议先看目录快速定位想读章节。';
    if (readProgress < 55) {
      return activeTocTitle
        ? `当前定位在「${activeTocTitle}」，继续滚动可保持章节连贯阅读。`
        : '正在进入主阅读段落，保持节奏继续向下即可。';
    }
    if (readProgress < 90) {
      return activeTocTitle
        ? `已读过半，当前章节「${activeTocTitle}」。还剩约 ${remainingReadMinutes} 分钟。`
        : `已读过半，还剩约 ${remainingReadMinutes} 分钟。`;
    }
    return '接近结尾，读完后可以继续看相关推荐。';
  }, [activeTocTitle, readProgress, remainingReadMinutes, totalReadMinutes]);

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

  const handleGenerateAIGuide = async () => {
    if (!post || post.postType !== 'blog') return;
    setAIGuideLoading(true);
    setAIGuideError('');
    try {
      const data = await generateBlogReaderGuide(post.id);
      setAIGuide(data);
    } catch (error) {
      console.error('Failed to generate AI guide:', error);
      setAIGuideError('导读暂时生成失败，请稍后重试。');
    } finally {
      setAIGuideLoading(false);
    }
  };

  const handleAskPost = async () => {
    if (!post || post.postType !== 'blog') return;
    const question = askQuestion.trim();
    if (!question) {
      setAskError('请输入你想问的问题。');
      return;
    }
    setAskLoading(true);
    setAskError('');
    try {
      const data = await askBlogPost(post.id, { question });
      setAskResult(data);
    } catch (error) {
      console.error('Failed to ask blog question:', error);
      setAskError('暂时无法回答这个问题，请换个问法或稍后再试。');
    } finally {
      setAskLoading(false);
    }
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

  useEffect(() => {
    if (!post || post.postType !== 'blog') return;
    const updateProgress = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) {
        if (progressRef.current !== 0) {
          progressRef.current = 0;
          setReadProgress(0);
        }
        return;
      }
      const value = Math.min(100, Math.max(0, (scrollTop / docHeight) * 100));
      if (Math.abs(value - progressRef.current) >= 0.5) {
        progressRef.current = value;
        setReadProgress(value);
      }
    };
    const onScroll = () => {
      if (progressRafRef.current !== null) return;
      progressRafRef.current = window.requestAnimationFrame(() => {
        progressRafRef.current = null;
        updateProgress();
      });
    };
    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (progressRafRef.current !== null) {
        window.cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };
  }, [post]);

  useEffect(() => {
    if (!post || post.postType !== 'blog') return;
    let cancelled = false;

    const loadRelated = async () => {
      try {
        setRelatedLoading(true);
        const groupId =
          post.group?.id || (post.groupId && post.groupId !== '0' ? post.groupId : '');

        const [groupList, timelineList] = await Promise.all([
          getPosts({
            page: 1,
            pageSize: 12,
            postType: 'blog',
            sort: 'newest',
            groupId: groupId || undefined,
          }),
          getPosts({
            page: 1,
            pageSize: 50,
            postType: 'blog',
            sort: 'newest',
            groupId: groupId || undefined,
          }),
        ]);

        if (cancelled) return;

        const filteredRelated = (groupList.list || [])
          .filter((item) => item.id !== post.id)
          .slice(0, 4);
        setRelatedPosts(filteredRelated);

        let timeline = timelineList.list || [];
        let currentIndex = timeline.findIndex((item) => item.id === post.id);
        if (currentIndex < 0) {
          const globalTimeline = await getPosts({
            page: 1,
            pageSize: 50,
            postType: 'blog',
            sort: 'newest',
          });
          if (cancelled) return;
          timeline = globalTimeline.list || [];
          currentIndex = timeline.findIndex((item) => item.id === post.id);
        }

        if (currentIndex >= 0) {
          setAdjacentPosts({
            prev: timeline[currentIndex - 1] || null,
            next: timeline[currentIndex + 1] || null,
          });
        } else {
          setAdjacentPosts({ prev: null, next: null });
        }
      } catch {
        if (!cancelled) {
          setRelatedPosts([]);
          setAdjacentPosts({ prev: null, next: null });
        }
      } finally {
        if (!cancelled) setRelatedLoading(false);
      }
    };

    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [post]);

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
      <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-transparent">
        <div
          className="bg-theme-primary h-full transition-[width] duration-200"
          style={{ width: `${readProgress}%` }}
        />
      </div>
      <div
        data-blog-post-nav
        className="theme-header sticky top-0 z-40 border-b bg-white/88 backdrop-blur"
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
          <button
            type="button"
            onClick={handleReturn}
            className="border-theme-soft-strong inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm text-slate-600 transition hover:bg-theme-soft hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            {returnLabel}
          </button>

          <div className="flex items-center gap-2">
            <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs text-slate-500 sm:inline-flex">
              阅读进度 {Math.round(readProgress)}%
            </span>
            {activeTocTitle && (
              <span className="hidden max-w-[320px] truncate rounded-full bg-theme-soft px-3 py-1.5 text-xs text-theme-primary lg:inline-flex">
                正在阅读 · {activeTocTitle}
              </span>
            )}
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
      </div>

      <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
        <header className="grid gap-6 xl:grid-cols-[minmax(0,1.24fr)_360px]">
          <section className="theme-panel-shell relative overflow-hidden rounded-[38px] border bg-white/92 p-6 shadow-[0_28px_72px_rgba(85,64,34,0.14)] sm:p-8">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_6%,rgba(var(--theme-primary-rgb),0.16),transparent_32%),radial-gradient(circle_at_88%_0%,rgba(77,160,255,0.14),transparent_28%)]" />
            <div className="relative">
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
                <BlogCoverMedia src={post.cover} alt={post.title} compactFallback={false} />
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="theme-hero-shell overflow-hidden rounded-[30px] border p-6 shadow-[0_20px_52px_rgba(148,163,184,0.12)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-900">阅读导览</div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-slate-500">
                  共 {totalReadMinutes} 分钟
                </span>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-white/75 px-3 py-2.5">
                  <div className="text-[11px] text-slate-400">当前进度</div>
                  <div className="mt-1 font-medium text-slate-800">{Math.round(readProgress)}%</div>
                </div>
                <div className="rounded-2xl bg-white/75 px-3 py-2.5">
                  <div className="text-[11px] text-slate-400">预计剩余</div>
                  <div className="mt-1 font-medium text-slate-800">{remainingReadMinutes} 分钟</div>
                </div>
                <div className="rounded-2xl bg-white/75 px-3 py-2.5">
                  <div className="text-[11px] text-slate-400">当前章节</div>
                  <div className="mt-1 line-clamp-1 font-medium text-slate-800">
                    {activeTocTitle || '准备进入正文'}
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs leading-6 text-slate-500">{scrollStatusTip}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  onClick={() => scrollToSection(articleSectionRef.current)}
                >
                  直达正文
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full"
                  onClick={() => scrollToSection(commentSectionRef.current)}
                >
                  直达评论
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="theme-btn-primary relative h-8 rounded-full px-3.5 text-xs shadow-[0_10px_28px_rgba(var(--theme-primary-rgb),0.35)]"
                  onClick={() => void handleGenerateAIGuide()}
                  disabled={aiGuideLoading}
                >
                  {!aiGuideLoading ? (
                    <span className="absolute -right-1 -top-1 inline-flex h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_0_4px_rgba(251,191,36,0.18)] animate-pulse" />
                  ) : null}
                  {aiGuideLoading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                  )}
                  AI 导读
                </Button>
              </div>
              {aiGuideError ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {aiGuideError}
                </p>
              ) : null}
              {aiGuide ? (
                <div className="mt-3 rounded-2xl border border-theme-soft-strong bg-white/80 p-3">
                  <div className="text-xs font-medium text-theme-primary">AI 导读</div>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{aiGuide.guide}</p>
                  {aiGuide.highlights?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {aiGuide.highlights.map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-theme-soft px-2.5 py-1 text-[11px] text-theme-primary"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {aiGuide.path ? (
                    <p className="mt-2 text-[11px] text-slate-500">阅读路径：{aiGuide.path}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </aside>
        </header>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <section
              ref={articleSectionRef}
              className="theme-panel-shell rounded-[36px] border bg-white/95 p-6 shadow-[0_26px_70px_rgba(99,75,42,0.12)] sm:p-10"
            >
              <MarkdownContent
                content={processedContent}
                enableImagePreview
                imagePreviewTitle={post.title || '博客图片预览'}
              />
              {(adjacentPosts.prev || adjacentPosts.next) && (
                <div className="border-theme-soft-strong mt-12 border-t pt-6">
                  <div className="mb-3 text-sm font-medium text-slate-800">继续阅读</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {adjacentPosts.prev ? (
                      <Link
                        to={`/blog/${adjacentPosts.prev.id}`}
                        state={{ returnTo, returnLabel, source: 'blog-post' }}
                        className="rounded-2xl border border-theme-soft-strong bg-theme-soft/40 p-4 transition hover:bg-theme-soft/70"
                      >
                        <div className="text-xs text-slate-500">上一篇</div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                          {adjacentPosts.prev.title}
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-400">
                        已经是第一篇
                      </div>
                    )}
                    {adjacentPosts.next ? (
                      <Link
                        to={`/blog/${adjacentPosts.next.id}`}
                        state={{ returnTo, returnLabel, source: 'blog-post' }}
                        className="rounded-2xl border border-theme-soft-strong bg-theme-soft/40 p-4 transition hover:bg-theme-soft/70"
                      >
                        <div className="text-xs text-slate-500">下一篇</div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">
                          {adjacentPosts.next.title}
                        </div>
                      </Link>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-400">
                        已经是最后一篇
                      </div>
                    )}
                  </div>
                </div>
              )}
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
            </section>
            <section className="theme-panel-shell rounded-[28px] border p-5 shadow-[0_18px_46px_rgba(148,163,184,0.12)]">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Sparkles className="h-4 w-4 text-theme-primary" />
                问文章
              </div>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                基于当前文章内容回答，不会跨文章扩展。
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={askQuestion}
                  onChange={(event) => setAskQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleAskPost();
                    }
                  }}
                  placeholder="问问这篇文章的观点、结论或细节"
                  className="theme-input-border h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-theme-soft"
                />
                <Button
                  type="button"
                  className="theme-btn-primary h-10 rounded-xl px-4"
                  onClick={() => void handleAskPost()}
                  disabled={askLoading}
                >
                  {askLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '提问'}
                </Button>
              </div>
              {askError ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
                  {askError}
                </p>
              ) : null}
              {askResult ? (
                <div className="mt-3 rounded-2xl border border-theme-soft-strong bg-white/80 p-3">
                  <p className="text-sm leading-7 text-slate-700">{askResult.answer}</p>
                  {askResult.citations?.length ? (
                    <div className="mt-3 space-y-2">
                      {askResult.citations.map((item, index) => (
                        <div
                          key={`${item.heading}-${index}`}
                          className="rounded-xl bg-theme-soft/60 px-3 py-2"
                        >
                          {item.heading ? (
                            <div className="text-[11px] font-medium text-theme-primary">
                              {item.heading}
                            </div>
                          ) : null}
                          <div className="mt-1 text-[11px] leading-5 text-slate-600">
                            {item.quote}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
            <div ref={commentSectionRef}>
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
            </div>
          </main>

          <aside className="space-y-6 xl:sticky xl:top-20 xl:self-start">
            {toc.length > 0 && (
              <section className="theme-panel-shell rounded-[30px] border p-6 shadow-[0_20px_52px_rgba(148,163,184,0.12)]">
                <div className="text-sm font-medium text-slate-900">目录导读</div>
                <div className="mt-4 max-h-[42vh] overflow-y-auto overflow-x-hidden pr-1">
                  <TableOfContents
                    toc={toc}
                    activeId={activeTocId}
                    onActiveIdChange={setActiveTocId}
                  />
                </div>
              </section>
            )}

            <section className="theme-panel-shell rounded-[30px] border p-6 shadow-[0_20px_52px_rgba(148,163,184,0.12)]">
              <div className="text-sm font-medium text-slate-900">阅读状态</div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>进度</span>
                  <span className="text-theme-primary font-medium">
                    {Math.round(readProgress)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-theme-soft">
                  <div
                    className="bg-theme-primary h-full rounded-full transition-[width] duration-200"
                    style={{ width: `${readProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>预计剩余</span>
                  <span>{remainingReadMinutes} 分钟</span>
                </div>
                <div className="rounded-xl bg-theme-soft/55 px-3 py-2 text-xs leading-5 text-slate-600">
                  {scrollStatusTip}
                </div>
              </div>
            </section>
            <section className="theme-panel-shell rounded-[30px] border p-6 shadow-[0_20px_52px_rgba(148,163,184,0.12)]">
              <div className="text-sm font-medium text-slate-900">相关推荐</div>
              {relatedLoading ? (
                <div className="mt-4 space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-14 animate-pulse rounded-xl bg-theme-soft/60" />
                  ))}
                </div>
              ) : relatedPosts.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {relatedPosts.map((item) => (
                    <Link
                      key={item.id}
                      to={`/blog/${item.id}`}
                      state={{ returnTo, returnLabel, source: 'blog-post' }}
                      className="block rounded-xl border border-theme-soft-strong bg-theme-soft/30 px-3 py-2 transition hover:bg-theme-soft/65"
                    >
                      <div className="line-clamp-2 text-sm text-slate-700">{item.title}</div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {item.group?.name || '未分组'} ·{' '}
                        {formatDate(item.publishedAt || item.createdAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">暂未获取到相关推荐。</p>
              )}
            </section>
          </aside>
        </div>

        {toc.length > 0 && (
          <>
            <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 px-4 xl:hidden">
              <div className="pointer-events-auto mx-auto flex max-w-xl items-center gap-2 rounded-full border border-theme-soft-strong bg-white/94 p-2 shadow-[0_18px_44px_rgba(100,77,38,0.18)] backdrop-blur">
                <div className="min-w-0 flex-1 rounded-full bg-theme-soft/60 px-3 py-1.5 text-xs text-slate-600">
                  <div className="truncate">
                    {activeTocTitle ? `正在阅读：${activeTocTitle}` : '打开目录快速定位章节'}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    进度 {Math.round(readProgress)}%
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="theme-btn-primary h-9 rounded-full px-4 text-xs"
                  onClick={() => setMobileTocOpen(true)}
                >
                  <List className="mr-1.5 h-3.5 w-3.5" />
                  目录
                </Button>
              </div>
            </div>

            {mobileTocOpen && (
              <div className="fixed inset-0 z-50 xl:hidden">
                <button
                  type="button"
                  className="absolute inset-0 bg-slate-900/28"
                  aria-label="关闭目录面板"
                  onClick={() => setMobileTocOpen(false)}
                />
                <section className="theme-panel-shell absolute bottom-0 left-0 right-0 rounded-t-[24px] border border-b-0 bg-white px-4 pb-6 pt-4 shadow-[0_-24px_60px_rgba(15,23,42,0.2)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-900">目录导读</div>
                      <div className="mt-1 text-xs text-slate-500">点击标题即可跳转到对应章节</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => setMobileTocOpen(false)}
                    >
                      收起
                    </Button>
                  </div>
                  <div className="max-h-[52vh] overflow-y-auto overflow-x-hidden pr-1">
                    <TableOfContents
                      toc={toc}
                      activeId={activeTocId}
                      onActiveIdChange={setActiveTocId}
                      onItemSelect={() => setMobileTocOpen(false)}
                    />
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
