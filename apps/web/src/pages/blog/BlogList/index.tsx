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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
    <Card className="border-border/50">
      <CardContent className="p-0">
        <div className={`relative border-b border-border bg-muted ${BLOG_COVER_ASPECT_CLASS}`}>
          <Skeleton className="absolute inset-0 rounded-none" />
          <div className="absolute left-3 top-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full bg-card/80" />
            <Skeleton className="h-6 w-16 rounded-full bg-card/80" />
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
      </CardContent>
    </Card>
  );
}

export default function BlogList() {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { user } = useAuthStore();
  const isLoggedIn = !!user;

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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-6 sm:px-6 md:px-8 lg:px-10">
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-6 sm:p-8 md:p-10">
            <div className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-4 py-1.5 text-[11px] font-semibold tracking-[0.2em] uppercase text-primary">
                  <Orbit className="h-3.5 w-3.5" />
                  Valley Blogs
                </div>
                <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
                  博客主题深读中心
                </h1>
                <p className="max-w-3xl text-sm leading-8 text-muted-foreground md:text-base">
                  先选分组，再深读内容。我们把博客按主题聚合，让阅读路径更清晰、更高效、更有沉浸感。
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
                    <BookOpen className="h-4 w-4 text-primary" />
                    {total} 篇博客
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground">
                    <FolderTree className="h-4 w-4 text-primary" />
                    {groups.length} 个分组
                  </span>
                  {selectedGroupName && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent/50 px-4 py-2 text-sm text-primary">
                      <Sparkles className="h-4 w-4" />
                      当前：{selectedGroupName}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="mb-2 text-sm font-medium text-foreground">搜索博客</div>
                    <div className="flex flex-wrap gap-2">
                      <div className="relative min-w-[220px] grow">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={postKeywordInput}
                          onChange={(event) => setPostKeywordInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handlePostKeywordSearch();
                          }}
                          placeholder="搜索标题、摘要、关键词"
                          className="pl-10"
                        />
                      </div>
                      <Button onClick={handlePostKeywordSearch}>搜索</Button>
                      {currentKeyword && (
                        <Button
                          variant="ghost"
                          onClick={clearPostKeyword}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          清除
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => setAIRecommendOpen(true)}>
                        <Sparkles className="mr-1.5 h-4 w-4" />
                        AI 推荐读哪篇
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 text-sm font-medium text-foreground">
                      <ArrowUpDown className="h-4 w-4 text-primary" />
                      排序方式
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full border border-accent bg-card p-1">
                      <button
                        type="button"
                        onClick={() => handleSortChange('newest')}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          currentSort === 'newest'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        最新优先
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSortChange('oldest')}
                        className={`rounded-full px-4 py-2 text-sm transition ${
                          currentSort === 'oldest'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent'
                        }`}
                      >
                        最早优先
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 mt-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <FolderTree className="h-4 w-4 text-primary" />
                分组优先导航
              </div>
              {(selectedGroupId || currentKeyword) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground hover:text-foreground"
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
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-accent'
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
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {group.name}
                  <span className="ml-1.5 text-xs opacity-70">{group.count}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-7 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            <Card className="border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3 text-foreground">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-accent/50 text-primary">
                    <FolderTree className="h-4 w-4" />
                  </span>
                  <span className="text-base font-semibold">分组矩阵</span>
                </div>

                {metaLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-11 rounded-lg" />
                    ))}
                  </div>
                ) : groupData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">还没有可用分组。</p>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={groupKeyword}
                        onChange={(event) => setGroupKeyword(event.target.value)}
                        placeholder="搜索分组"
                        className="h-10 pl-9"
                      />
                    </div>

                    <div className="max-h-[440px] space-y-2 overflow-auto pr-1">
                      {visibleGroupData.map((group) => (
                        <button
                          type="button"
                          key={group.id}
                          onClick={() => handleGroupClick(group.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm transition ${
                            selectedGroupId === group.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          <span className="min-w-0 truncate pr-2 font-medium">{group.name}</span>
                          <span className="text-xs opacity-70">{group.count}</span>
                        </button>
                      ))}
                    </div>

                    {filteredGroupData.length === 0 ? (
                      <p className="text-sm text-muted-foreground">未找到匹配分组。</p>
                    ) : filteredGroupData.length > 14 ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowAllGroups((prev) => !prev)}
                      >
                        {showAllGroups
                          ? '收起分组列表'
                          : `查看更多分组${hiddenGroupCount > 0 ? `（+${hiddenGroupCount}）` : ''}`}
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            {isLoggedIn && (
              <Button onClick={() => navigate('/my-space/posts')} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                前往我的创作空间
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
              <Card className="border-dashed border-border">
                <CardContent className="px-8 py-16 text-center">
                  <div className="mx-auto flex max-w-xl flex-col items-center gap-3 text-muted-foreground">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/50 text-primary">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </span>
                    <h3 className="text-xl font-semibold text-foreground">正在切换分组结果</h3>
                    <p className="text-sm">
                      {selectedGroupName
                        ? `正在读取分组「${selectedGroupName}」的博客内容，请稍候。`
                        : '正在刷新当前筛选结果，请稍候。'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : posts.length === 0 ? (
              <Card className="border-dashed border-border">
                <CardContent className="px-8 py-16 text-center">
                  <div className="mx-auto max-w-xl space-y-3">
                    <h3 className="text-xl font-semibold text-foreground">当前筛选下暂无博客</h3>
                    <p className="text-sm text-muted-foreground">
                      {currentKeyword
                        ? `没有找到包含"${currentKeyword}"的博客，试试其他关键词。`
                        : selectedGroupName
                          ? `当前分组「${selectedGroupName}」暂无博客，可以切换分组继续阅读。`
                          : '新的博客发布后会优先展示在这里。'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="relative">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="text-sm text-muted-foreground">
                      {selectedGroupName
                        ? `当前分组：${selectedGroupName} · 第 ${currentPage} / ${totalPages} 页`
                        : `第 ${currentPage} / ${totalPages} 页 · 共 ${total} 篇博客`}
                    </div>
                    {currentKeyword && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/50 px-3 py-1 text-xs text-primary">
                        <Search className="h-3.5 w-3.5" />
                        关键词：{currentKeyword}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {posts.map((post) => (
                      <BlogFeedCard key={post.id} post={post} />
                    ))}
                  </div>
                  <BoxLoadingOverlay
                    show={refreshing}
                    title="正在刷新博客..."
                    hint="筛选与排序结果同步中"
                  />
                </div>

                {total > PAGE_SIZE && (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button
                      variant="outline"
                      disabled={currentPage <= 1 || refreshing}
                      onClick={() => setValue('page', currentPage - 1)}
                    >
                      上一页
                    </Button>
                    <span className="rounded-full bg-card px-4 py-2 text-sm text-muted-foreground">
                      第 {currentPage} / {totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      disabled={currentPage >= totalPages || refreshing}
                      onClick={() => setValue('page', currentPage + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 transition ${aiRecommendOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      >
        <button
          type="button"
          aria-label="关闭 AI 推荐抽屉"
          onClick={() => setAIRecommendOpen(false)}
          className={`absolute inset-0 bg-foreground/15 transition-opacity duration-200 ${aiRecommendOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <aside
          className={`absolute right-0 top-0 h-full w-[min(92vw,560px)] border-l border-border bg-background shadow-lg transition-transform duration-300 ease-out ${aiRecommendOpen ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex h-full flex-col">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  AI 阅读路线
                </span>
                <button
                  type="button"
                  onClick={() => setAIRecommendOpen(false)}
                  className="rounded-full bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-5 pt-4">
              <div className="flex gap-2">
                <Input
                  value={aiPrompt}
                  onChange={(event) => setAIPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void handleAIRecommend();
                    } else if (event.key === 'Escape') {
                      setAIRecommendOpen(false);
                    }
                  }}
                  placeholder="例如：想看 JS 异步、CSS 布局、React 性能优化"
                />
                <Button onClick={() => void handleAIRecommend()} disabled={aiRecommendLoading}>
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
                    className="rounded-full border border-accent bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:bg-accent hover:text-primary"
                  >
                    {intent}
                  </button>
                ))}
              </div>

              {aiRecommendError && <p className="text-xs text-destructive">{aiRecommendError}</p>}

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
                      className="w-full rounded-lg border border-accent bg-accent/35 px-3 py-2 text-left transition hover:bg-accent/70"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="line-clamp-2 text-sm font-medium text-foreground">
                          {index + 1}. {item.title}
                        </div>
                        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                          约 {item.readMinutes} 分钟
                        </span>
                      </div>
                      {item.excerpt && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {item.excerpt}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-2 text-[11px]">
                        {item.groupName && (
                          <span className="rounded-full bg-card px-2 py-0.5 text-primary">
                            {item.groupName}
                          </span>
                        )}
                        <span className="text-muted-foreground">{item.reason}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : aiPrompt && !aiRecommendLoading && !aiRecommendError ? (
                <p className="rounded-lg bg-card px-3 py-2 text-xs text-muted-foreground">
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
