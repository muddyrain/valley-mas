import {
  ArrowUpDown,
  BookOpen,
  ExternalLink,
  FolderTree,
  Loader2,
  Orbit,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { BlogRecommendResponse, Group, Post } from '@/api/blog';
import { getGroups, getPosts, recommendBlogPosts } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { BlogFeedCard } from '@/components/blog';
import { BLOG_COVER_ASPECT_CLASS } from '@/components/blog/BlogCoverMedia';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  enumParam,
  numberParam,
  stringParam,
  useUrlQueryState,
} from '@/hooks/useUrlPaginationQuery';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_SIZE = 12;
const BLOG_LIST_SCROLL_STORAGE_PREFIX = 'blog-list-scroll:v1';
const BLOG_LIST_QUERY_SCHEMA = {
  page: numberParam(1, { min: 1 }),
  keyword: stringParam('', { resetPageOnChange: true }),
  groupId: stringParam('', { resetPageOnChange: true }),
  sort: enumParam(['oldest', 'newest'] as const, 'newest', { resetPageOnChange: true }),
};

function BlogFeedCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-theme-soft-strong bg-white/80 p-2 shadow-[0_14px_40px_rgba(148,163,184,0.08)]">
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div
          className={`relative border-b border-slate-100 bg-theme-soft ${BLOG_COVER_ASPECT_CLASS}`}
        >
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="absolute left-3 top-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full bg-white/80" />
            <Skeleton className="h-6 w-16 rounded-full bg-white/80" />
          </div>
        </div>
        <div className="space-y-3 p-4">
          <Skeleton className="h-6 w-[85%] rounded-lg" />
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-[92%] rounded-md" />
          <Skeleton className="h-4 w-[70%] rounded-md" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogList() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { user, profile, fetchProfile } = useAuthStore();
  const isCreator = user?.role === 'creator';

  const {
    searchParams,
    values: {
      groupId: selectedGroupId,
      keyword: currentKeyword,
      page: currentPage,
      sort: currentSort,
    },
    setValue,
    setValues,
    updateParams,
  } = useUrlQueryState(BLOG_LIST_QUERY_SCHEMA, { pageKey: 'page' });

  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [allPostsTotal, setAllPostsTotal] = useState(0);
  const [groupKeyword, setGroupKeyword] = useState('');
  const [postKeywordInput, setPostKeywordInput] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [aiRecommendOpen, setAIRecommendOpen] = useState(false);
  const [aiPrompt, setAIPrompt] = useState('');
  const [aiRecommendLoading, setAIRecommendLoading] = useState(false);
  const [aiRecommendError, setAIRecommendError] = useState('');
  const [aiRecommendResult, setAIRecommendResult] = useState<BlogRecommendResponse | null>(null);
  const firstLoadRef = useRef(true);
  const scrollRestoredRef = useRef(false);
  const scrollStorageKey = useMemo(
    () => `${BLOG_LIST_SCROLL_STORAGE_PREFIX}:${location.pathname}${location.search}`,
    [location.pathname, location.search],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!searchParams.has('tag')) return;
    updateParams(
      (next: URLSearchParams) => {
        next.delete('tag');
      },
      { replace: true },
    );
  }, [searchParams, updateParams]);

  useEffect(() => {
    setPostKeywordInput(currentKeyword);
  }, [currentKeyword]);

  const loadTaxonomy = useCallback(async () => {
    try {
      const groupsData = await getGroups({ groupType: 'blog' });
      setGroups(groupsData || []);
    } catch (error) {
      console.error('Failed to load blog groups:', error);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  const loadAllPostsTotal = useCallback(async () => {
    try {
      const postsData = await getPosts({
        page: 1,
        pageSize: 1,
        postType: 'blog',
        keyword: currentKeyword || undefined,
      });
      setAllPostsTotal(postsData.total || 0);
    } catch (error) {
      console.error('Failed to load total blog count:', error);
    }
  }, [currentKeyword]);

  useEffect(() => {
    void loadAllPostsTotal();
  }, [loadAllPostsTotal]);

  const loadPosts = useCallback(async () => {
    const isFirstLoad = firstLoadRef.current;
    if (isFirstLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const postsData = await getPosts({
        page: currentPage,
        pageSize: PAGE_SIZE,
        postType: 'blog',
        groupId: selectedGroupId || undefined,
        keyword: currentKeyword || undefined,
        sort: currentSort,
      });

      const nextPosts = postsData.list || [];
      const nextTotal = postsData.total || 0;
      setPosts(nextPosts);
      setTotal(nextTotal);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      if (isFirstLoad) {
        firstLoadRef.current = false;
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [currentKeyword, currentPage, currentSort, selectedGroupId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem(scrollStorageKey, String(window.scrollY));
    };
    window.addEventListener('scroll', saveScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', saveScroll);
      saveScroll();
    };
  }, [scrollStorageKey]);

  useEffect(() => {
    scrollRestoredRef.current = false;
  }, [scrollStorageKey]);

  useEffect(() => {
    if (navigationType !== 'POP') return;
    if (loading) return;
    if (scrollRestoredRef.current) return;

    const rawValue = sessionStorage.getItem(scrollStorageKey);
    if (!rawValue) {
      scrollRestoredRef.current = true;
      return;
    }

    const nextScrollY = Number(rawValue);
    if (!Number.isFinite(nextScrollY) || nextScrollY < 0) {
      scrollRestoredRef.current = true;
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollY, behavior: 'auto' });
      scrollRestoredRef.current = true;
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [loading, navigationType, scrollStorageKey]);

  useEffect(() => {
    if (isCreator) void fetchProfile();
  }, [fetchProfile, isCreator]);

  const handleGroupClick = (targetGroupId: string) => {
    if (!targetGroupId) return;
    if (selectedGroupId === targetGroupId) {
      setValue('groupId', '');
      return;
    }
    setValue('groupId', targetGroupId);
  };

  const clearFilters = () => {
    setValues({ groupId: '', keyword: '', page: 1 });
    setPostKeywordInput('');
  };

  const handlePostKeywordSearch = () => {
    setValue('keyword', postKeywordInput);
  };

  const clearPostKeyword = () => {
    setPostKeywordInput('');
    setValue('keyword', '');
  };

  const handleSortChange = (nextSort: 'oldest' | 'newest') => {
    if (nextSort === currentSort) return;
    setValue('sort', nextSort);
  };

  const handleAIRecommend = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAIRecommendError('请输入你想读的主题或问题。');
      return;
    }
    setAIRecommendLoading(true);
    setAIRecommendError('');
    setAIRecommendResult(null);
    try {
      const data = await recommendBlogPosts({
        prompt,
        groupId: selectedGroupId || undefined,
        keyword: currentKeyword || undefined,
        sort: currentSort,
      });
      setAIRecommendResult(data);
    } catch (error) {
      console.error('Failed to recommend blogs by AI:', error);
      setAIRecommendError('暂时无法生成推荐，请稍后再试。');
    } finally {
      setAIRecommendLoading(false);
    }
  };

  const quickIntents = [
    '想看 JavaScript / TypeScript 实战技巧',
    '想看 HTML + CSS 布局与样式进阶',
    '想看 Vue/React 框架与工程化实践',
  ];

  const groupData = useMemo(
    () =>
      groups.map((item) => ({
        name: item.name,
        id: item.id,
        count: item.postCount || 0,
      })),
    [groups],
  );

  const selectedGroupName = useMemo(
    () => groups.find((group) => group.id === selectedGroupId)?.name || '',
    [groups, selectedGroupId],
  );

  const filteredGroupData = useMemo(() => {
    const keyword = groupKeyword.trim().toLowerCase();
    if (!keyword) return groupData;
    return groupData.filter((group) => group.name.toLowerCase().includes(keyword));
  }, [groupData, groupKeyword]);

  const topGroups = useMemo(
    () => [...groupData].sort((a, b) => b.count - a.count).slice(0, 8),
    [groupData],
  );

  const visibleGroupData = useMemo(() => {
    if (showAllGroups) return filteredGroupData;
    return filteredGroupData.slice(0, 14);
  }, [filteredGroupData, showAllGroups]);

  const hiddenGroupCount = Math.max(filteredGroupData.length - visibleGroupData.length, 0);
  const showEmptyRefreshingState = refreshing && posts.length === 0;

  useEffect(() => {
    setShowAllGroups(false);
  }, [groupKeyword]);

  useEffect(() => {
    if (!aiRecommendOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [aiRecommendOpen]);

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-[1500px] px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="relative overflow-hidden rounded-[42px] border border-white/75 bg-white/80 px-6 py-8 shadow-[0_30px_85px_rgba(77,53,26,0.12)] md:px-9 md:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_18%,rgba(var(--theme-primary-rgb),0.18),transparent_38%),radial-gradient(circle_at_86%_12%,rgba(var(--theme-primary-rgb),0.12),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.95),rgba(var(--theme-primary-rgb),0.05))]" />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <span
              className="absolute -left-10 top-8 h-28 w-28 rounded-full bg-theme-soft/55 blur-2xl animate-pulse"
              style={{ animationDuration: '9s' }}
            />
            <span
              className="absolute right-14 top-4 h-20 w-20 rounded-[28px] border border-theme-soft-strong/70 bg-white/45 rotate-12 animate-pulse"
              style={{ animationDuration: '11s', animationDelay: '1.2s' }}
            />
            <span
              className="absolute -bottom-8 right-28 h-36 w-36 rounded-full border border-theme-soft-strong/70 bg-theme-soft/45 blur-xl animate-pulse"
              style={{ animationDuration: '12s', animationDelay: '0.6s' }}
            />
          </div>
          <div className="relative grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/88 px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-theme-primary shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.16)]">
                <Orbit className="h-3.5 w-3.5" />
                Valley Blogs
              </span>
              <h1 className="text-[42px] font-semibold leading-[1.08] tracking-[-0.045em] text-slate-950 md:text-[54px]">
                博客主题深读中心
              </h1>
              <p className="max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
                先选分组，再深读内容。我们把博客按主题聚合，让阅读路径更清晰、更高效、更有沉浸感。
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-4 py-2 text-sm text-slate-700">
                  <BookOpen className="h-4 w-4 text-theme-primary" />
                  {total} 篇博客
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/92 px-4 py-2 text-sm text-slate-700">
                  <FolderTree className="h-4 w-4 text-theme-primary" />
                  {groups.length} 个分组
                </span>
                {selectedGroupName && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-theme-soft-strong bg-theme-soft px-4 py-2 text-sm text-theme-primary">
                    <Sparkles className="h-4 w-4" />
                    当前：{selectedGroupName}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-white/85 bg-white/92 p-4 shadow-[0_16px_34px_rgba(148,163,184,0.12)]">
                <div className="mb-2 text-sm font-medium text-slate-700">搜索博客</div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[220px] grow">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={postKeywordInput}
                      onChange={(event) => setPostKeywordInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handlePostKeywordSearch();
                      }}
                      placeholder="搜索标题、摘要、关键词"
                      className="theme-input-border h-11 w-full rounded-2xl border bg-white pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-theme-soft"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handlePostKeywordSearch}
                    className="theme-btn-primary h-11 rounded-2xl px-5"
                  >
                    搜索
                  </Button>
                  {currentKeyword ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearPostKeyword}
                      className="h-11 rounded-2xl px-4 text-slate-500 hover:bg-theme-soft hover:text-slate-900"
                    >
                      清除
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="border-theme-soft-strong h-11 rounded-2xl px-4 text-theme-primary"
                    onClick={() => setAIRecommendOpen(true)}
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    AI 推荐读哪篇
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/85 bg-white/92 p-4 shadow-[0_16px_34px_rgba(148,163,184,0.12)]">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ArrowUpDown className="h-4 w-4 text-theme-primary" />
                  排序方式
                </div>
                <div className="inline-flex items-center gap-1 rounded-full border border-theme-soft-strong bg-white p-1">
                  <button
                    type="button"
                    onClick={() => handleSortChange('newest')}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      currentSort === 'newest'
                        ? 'bg-theme-primary text-white'
                        : 'text-slate-600 hover:bg-theme-soft'
                    }`}
                  >
                    最新优先
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSortChange('oldest')}
                    className={`rounded-full px-4 py-2 text-sm transition ${
                      currentSort === 'oldest'
                        ? 'bg-theme-primary text-white'
                        : 'text-slate-600 hover:bg-theme-soft'
                    }`}
                  >
                    最早优先
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[30px] border border-white/80 bg-white/84 p-4 shadow-[0_22px_52px_rgba(148,163,184,0.12)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <FolderTree className="h-4 w-4 text-theme-primary" />
              分组优先导航
            </div>
            {(selectedGroupId || currentKeyword) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="rounded-full px-3 text-slate-500 hover:bg-theme-soft hover:text-slate-900"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                清空筛选
              </Button>
            )}
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setValue('groupId', '')}
              className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
                !selectedGroupId
                  ? 'bg-theme-primary text-white shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.28)]'
                  : 'bg-[#fbfaf8] text-slate-600 hover:bg-white hover:text-slate-950'
              }`}
            >
              全部分组
              <span className="ml-1.5 text-xs opacity-70">{allPostsTotal}</span>
            </button>
            {topGroups.map((group) => (
              <button
                type="button"
                key={group.id}
                onClick={() => handleGroupClick(group.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm transition ${
                  selectedGroupId === group.id
                    ? 'bg-theme-primary text-white shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.28)]'
                    : 'bg-[#fbfaf8] text-slate-600 hover:bg-white hover:text-slate-950'
                }`}
              >
                {group.name}
                <span className="ml-1.5 text-xs opacity-70">{group.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-7 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <div className="rounded-[28px] border border-white/80 bg-white/88 p-5 shadow-[0_18px_44px_rgba(148,163,184,0.12)]">
              <div className="mb-3 flex items-center gap-2 text-slate-900">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-theme-soft text-theme-primary">
                  <FolderTree className="h-4 w-4" />
                </span>
                <span className="text-base font-semibold">分组矩阵</span>
              </div>

              {metaLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-11 rounded-[14px]" />
                  ))}
                </div>
              ) : groupData.length === 0 ? (
                <p className="text-sm leading-7 text-slate-500">还没有可用分组。</p>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={groupKeyword}
                      onChange={(event) => setGroupKeyword(event.target.value)}
                      placeholder="搜索分组"
                      className="theme-input-border h-10 w-full rounded-xl border bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-theme-soft"
                    />
                  </div>

                  <div className="max-h-[440px] space-y-2 overflow-auto pr-1">
                    {visibleGroupData.map((group) => (
                      <button
                        type="button"
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                          selectedGroupId === group.id
                            ? 'bg-theme-primary text-white shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.28)]'
                            : 'bg-[#fbfaf8] text-slate-600 hover:bg-white hover:text-slate-950'
                        }`}
                      >
                        <span className="min-w-0 truncate pr-2 font-medium">{group.name}</span>
                        <span className="text-xs opacity-70">{group.count}</span>
                      </button>
                    ))}
                  </div>

                  {filteredGroupData.length === 0 ? (
                    <p className="text-sm text-slate-500">未找到匹配分组。</p>
                  ) : filteredGroupData.length > 14 ? (
                    <Button
                      variant="outline"
                      className="border-theme-soft-strong w-full rounded-full bg-white text-theme-primary"
                      onClick={() => setShowAllGroups((prev) => !prev)}
                    >
                      {showAllGroups
                        ? '收起分组列表'
                        : `查看更多分组${hiddenGroupCount > 0 ? `（+${hiddenGroupCount}）` : ''}`}
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            {isCreator && profile?.creatorCode && (
              <Button
                onClick={() => navigate('/my-space/posts')}
                className="theme-btn-primary h-11 w-full gap-2 rounded-2xl"
              >
                <ExternalLink className="h-4 w-4" />
                前往我的创作者空间
              </Button>
            )}
          </aside>

          <div className="space-y-6">
            {loading ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <BlogFeedCardSkeleton key={index} />
                ))}
              </div>
            ) : showEmptyRefreshingState ? (
              <div className="rounded-[34px] border border-dashed border-theme-soft-strong bg-white/82 px-8 py-16 text-center shadow-[0_24px_56px_rgba(148,163,184,0.1)]">
                <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-slate-500">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-theme-soft text-theme-primary shadow-[0_12px_28px_rgba(var(--theme-primary-rgb),0.18)]">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </span>
                  <h3 className="text-2xl font-semibold text-slate-900">正在切换分组结果</h3>
                  <p className="text-sm leading-8 text-slate-500">
                    {selectedGroupName
                      ? `正在读取分组「${selectedGroupName}」的博客内容，请稍候。`
                      : '正在刷新当前筛选结果，请稍候。'}
                  </p>
                </div>
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-[34px] border border-dashed border-theme-soft-strong bg-white/76 px-8 py-16 text-center shadow-[0_24px_56px_rgba(148,163,184,0.1)]">
                <div className="mx-auto max-w-xl space-y-3">
                  <h3 className="text-2xl font-semibold text-slate-900">当前筛选下暂无博客</h3>
                  <p className="text-sm leading-8 text-slate-500">
                    {currentKeyword
                      ? `没有找到包含“${currentKeyword}”的博客，试试其他关键词。`
                      : selectedGroupName
                        ? `当前分组「${selectedGroupName}」暂无博客，可以切换分组继续阅读。`
                        : '新的博客发布后会优先展示在这里。'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-slate-500">
                      {selectedGroupName
                        ? `当前分组：${selectedGroupName} · 第 ${currentPage} / ${totalPages} 页`
                        : `第 ${currentPage} / ${totalPages} 页 · 共 ${total} 篇博客`}
                    </div>
                    {currentKeyword ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-theme-soft px-3 py-1 text-xs text-theme-primary">
                        <Search className="h-3.5 w-3.5" />
                        关键词：{currentKeyword}
                      </span>
                    ) : null}
                  </div>

                  <div
                    className={`grid gap-5 transition-opacity duration-200 md:grid-cols-2 xl:grid-cols-3 ${
                      refreshing ? 'opacity-75' : 'opacity-100'
                    }`}
                  >
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        className="rounded-[30px] bg-white/68 p-2 shadow-[0_14px_40px_rgba(148,163,184,0.08)]"
                      >
                        <BlogFeedCard post={post} />
                      </div>
                    ))}
                  </div>
                  <BoxLoadingOverlay
                    show={refreshing}
                    title="正在刷新博客..."
                    hint="筛选与排序结果同步中"
                  />
                </div>

                {total > PAGE_SIZE ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      className="border-theme-soft-strong rounded-full border bg-white/82 px-5"
                      disabled={currentPage <= 1 || refreshing}
                      onClick={() => setValue('page', currentPage - 1)}
                    >
                      上一页
                    </Button>
                    <span className="rounded-full bg-white/82 px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_rgba(148,163,184,0.06)]">
                      第 {currentPage} / {totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      className="border-theme-soft-strong rounded-full border bg-white/82 px-5"
                      disabled={currentPage >= totalPages || refreshing}
                      onClick={() => setValue('page', currentPage + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-50 transition ${aiRecommendOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <button
          type="button"
          aria-label="关闭 AI 推荐抽屉"
          onClick={() => setAIRecommendOpen(false)}
          className={`absolute inset-0 bg-slate-900/28 transition-opacity duration-200 ${aiRecommendOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-[min(92vw,560px)] border-l border-theme-soft-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,252,247,0.95))] shadow-[-24px_0_60px_rgba(66,42,18,0.2)] transition-transform duration-300 ease-out ${aiRecommendOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-theme-soft-strong px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Sparkles className="h-4 w-4 text-theme-primary animate-pulse" />
                  AI 阅读路线
                </span>
                <button
                  type="button"
                  onClick={() => setAIRecommendOpen(false)}
                  className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-slate-500 transition hover:text-slate-800"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5 pt-4">
              <div className="flex gap-2">
                <input
                  value={aiPrompt}
                  onChange={(event) => setAIPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleAIRecommend();
                    }
                  }}
                  placeholder="例如：想看 JS 异步、CSS 布局、React 性能优化"
                  className="theme-input-border h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-theme-soft"
                />
                <Button
                  type="button"
                  className="theme-btn-primary h-10 rounded-xl px-4"
                  onClick={() => void handleAIRecommend()}
                  disabled={aiRecommendLoading}
                >
                  {aiRecommendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : '生成推荐'}
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quickIntents.map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => {
                      setAIPrompt(intent);
                      setAIRecommendError('');
                    }}
                    className="rounded-full border border-theme-soft-strong bg-white/90 px-2.5 py-1 text-[11px] text-slate-600 transition hover:bg-theme-soft hover:text-theme-primary"
                  >
                    {intent}
                  </button>
                ))}
              </div>

              {aiRecommendError ? (
                <p className="text-xs text-rose-600">{aiRecommendError}</p>
              ) : null}

              {aiRecommendResult?.items?.length ? (
                <div className="space-y-2">
                  {aiRecommendResult.items.map((item, index) => (
                    <button
                      key={item.postId}
                      type="button"
                      onClick={() => {
                        setAIRecommendOpen(false);
                        navigate(`/blog/${item.postId}`, {
                          state: {
                            returnTo: `/blog${window.location.search}`,
                            returnLabel: '返回博客列表',
                            source: 'blog-ai-recommend',
                          },
                        });
                      }}
                      className="w-full rounded-xl border border-theme-soft-strong bg-theme-soft/35 px-3 py-2 text-left transition hover:-translate-y-0.5 hover:bg-theme-soft/70 hover:shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.2)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="line-clamp-2 text-sm font-medium text-slate-800">
                          {index + 1}. {item.title}
                        </div>
                        <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-slate-500">
                          约 {item.readMinutes} 分钟
                        </span>
                      </div>
                      {item.excerpt ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                          {item.excerpt}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        {item.groupName ? (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-theme-primary">
                            {item.groupName}
                          </span>
                        ) : null}
                        <span className="text-slate-600">{item.reason}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : aiPrompt && !aiRecommendLoading && !aiRecommendError ? (
                <p className="rounded-xl bg-white/90 px-3 py-2 text-xs text-slate-500">
                  这次没有推荐结果，可以换个更具体的意图再试试。
                </p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
