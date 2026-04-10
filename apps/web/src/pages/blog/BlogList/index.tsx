import { ArrowUpDown, BookOpen, ExternalLink, FolderTree, Search, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Group, Post } from '@/api/blog';
import { getGroups, getPosts } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { BlogFeedCard } from '@/components/blog';
import { BLOG_COVER_ASPECT_CLASS } from '@/components/blog/BlogCoverMedia';
import HeroSectionTitle from '@/components/page/HeroSectionTitle';
import HeroStatChip from '@/components/page/HeroStatChip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/stores/useAuthStore';

const PAGE_SIZE = 12;

function FilterPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.08)] backdrop-blur">
      <div className="mb-4 flex items-center gap-2 text-slate-900">
        <span className="bg-theme-soft text-theme-primary inline-flex h-9 w-9 items-center justify-center rounded-full">
          {icon}
        </span>
        <span className="text-lg font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

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
  const { user, profile, fetchProfile } = useAuthStore();
  const isCreator = user?.role === 'creator';

  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metaLoading, setMetaLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [groupKeyword, setGroupKeyword] = useState('');
  const [showAllGroups, setShowAllGroups] = useState(false);
  const firstLoadRef = useRef(true);

  const selectedGroupId = searchParams.get('groupId') || '';
  const currentPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const currentSort: 'oldest' | 'newest' =
    searchParams.get('sort') === 'newest' ? 'newest' : 'oldest';
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!searchParams.has('tag')) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('tag');
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadTaxonomy = useCallback(async () => {
    try {
      const groupsData = await getGroups();
      setGroups(groupsData || []);
    } catch (error) {
      console.error('Failed to load blog filters:', error);
    } finally {
      setMetaLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

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
        groupId: selectedGroupId || undefined,
        sort: currentSort,
      });

      setPosts(postsData.list || []);
      setTotal(postsData.total || 0);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      if (isFirstLoad) {
        firstLoadRef.current = false;
        setLoading(false);
      }
      setRefreshing(false);
    }
  }, [currentPage, currentSort, selectedGroupId]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (isCreator) void fetchProfile();
  }, [fetchProfile, isCreator]);

  const handleGroupClick = (targetGroupId: string) => {
    if (!targetGroupId) return;
    const newParams = new URLSearchParams(searchParams);
    if (selectedGroupId === targetGroupId) {
      newParams.delete('groupId');
    } else {
      newParams.set('groupId', targetGroupId);
    }
    newParams.set('page', '1');
    newParams.set('sort', currentSort);
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    const newParams = new URLSearchParams();
    newParams.set('sort', currentSort);
    setSearchParams(newParams);
  };

  const handleSortChange = (nextSort: 'oldest' | 'newest') => {
    if (nextSort === currentSort) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', nextSort);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const groupData = useMemo(
    () =>
      groups.map((item) => ({
        name: item.name,
        id: item.id,
        count: item.postCount || 0,
      })),
    [groups],
  );

  const filteredGroupData = useMemo(() => {
    const keyword = groupKeyword.trim().toLowerCase();
    if (!keyword) return groupData;
    return groupData.filter((group) => group.name.toLowerCase().includes(keyword));
  }, [groupData, groupKeyword]);

  const quickGroupData = useMemo(() => {
    const sorted = [...groupData].sort((a, b) => b.count - a.count);
    const base = sorted.slice(0, 10);
    if (selectedGroupId) {
      const selected = sorted.find((group) => group.id === selectedGroupId);
      if (selected)
        return [selected, ...base.filter((group) => group.id !== selected.id)].slice(0, 10);
    }
    return base;
  }, [groupData, selectedGroupId]);

  const visibleGroupData = useMemo(() => {
    if (showAllGroups) return filteredGroupData;
    return filteredGroupData.slice(0, 12);
  }, [filteredGroupData, showAllGroups]);

  const hiddenGroupCount = Math.max(filteredGroupData.length - visibleGroupData.length, 0);

  useEffect(() => {
    setShowAllGroups(false);
  }, [groupKeyword]);

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-8 md:px-10 md:py-10">
          <div className="theme-hero-glow absolute inset-0" />
          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <HeroSectionTitle
                eyebrow="UPDATES"
                title="博客与图文"
                description="最近发布的博客、图文和内容分组都会汇在这里，方便继续浏览和筛选。"
                titleClassName="text-[34px] md:text-[40px]"
              />
              <div className="flex flex-wrap gap-3">
                <HeroStatChip icon={<BookOpen className="text-theme-primary h-4 w-4" />}>
                  {total} 篇内容
                </HeroStatChip>
                <HeroStatChip icon={<FolderTree className="h-4 w-4 text-theme-primary" />}>
                  {groups.length} 个分组
                </HeroStatChip>
              </div>

              {isCreator && profile?.creatorCode && (
                <div>
                  <Button
                    onClick={() => navigate('/my-space/posts')}
                    className="theme-btn-primary gap-2 rounded-full px-5 font-semibold shadow-md"
                  >
                    <ExternalLink className="h-4 w-4" />
                    前往我的创作者空间
                  </Button>
                </div>
              )}

              {selectedGroupId && (
                <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-500">当前筛选</span>
                    <span className="bg-theme-soft text-theme-primary inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm">
                      <FolderTree className="h-3.5 w-3.5" />
                      {groups.find((g) => g.id === selectedGroupId)?.name || selectedGroupId}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="rounded-full px-3 text-slate-500 hover:bg-white hover:text-slate-900"
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      清空筛选
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <FilterPanel title="内容分组" icon={<FolderTree className="h-4 w-4" />}>
                {metaLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-11 rounded-[18px]" />
                    ))}
                  </div>
                ) : groupData.length === 0 ? (
                  <p className="text-sm leading-7 text-slate-500">还没有可用的内容分组。</p>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={groupKeyword}
                        onChange={(event) => setGroupKeyword(event.target.value)}
                        placeholder="搜索分组"
                        className="theme-input-border h-10 w-full rounded-xl border bg-white/82 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-theme-soft"
                      />
                    </div>

                    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                      {quickGroupData.map((group) => (
                        <button
                          type="button"
                          key={`quick-${group.id}`}
                          onClick={() => handleGroupClick(group.id)}
                          className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${
                            selectedGroupId === group.id
                              ? 'bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]'
                              : 'bg-[#fbfaf8] text-slate-600 hover:bg-white hover:text-slate-950'
                          }`}
                        >
                          {group.name}
                          <span className="ml-1.5 text-xs opacity-70">{group.count}</span>
                        </button>
                      ))}
                    </div>

                    <div className="max-h-[340px] space-y-2 overflow-auto pr-1">
                      {visibleGroupData.map((group) => (
                        <button
                          type="button"
                          key={group.id}
                          onClick={() => handleGroupClick(group.id)}
                          className={`flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left text-sm transition ${
                            selectedGroupId === group.id
                              ? 'bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]'
                              : 'bg-[#fbfaf8] text-slate-600 hover:bg-white hover:text-slate-950'
                          }`}
                        >
                          <span className="min-w-0 truncate pr-3 font-medium">{group.name}</span>
                          <span className="shrink-0 text-xs opacity-70">{group.count}</span>
                        </button>
                      ))}
                    </div>

                    {filteredGroupData.length === 0 ? (
                      <p className="text-sm text-slate-500">未找到匹配分组。</p>
                    ) : filteredGroupData.length > 12 ? (
                      <Button
                        variant="outline"
                        className="border-theme-soft-strong w-full rounded-full bg-white/82 text-theme-primary"
                        onClick={() => setShowAllGroups((prev) => !prev)}
                      >
                        {showAllGroups
                          ? '收起分组列表'
                          : `查看更多分组${hiddenGroupCount > 0 ? `（+${hiddenGroupCount}）` : ''}`}
                      </Button>
                    ) : null}
                  </div>
                )}
              </FilterPanel>
            </div>
          </div>
        </section>

        <section className="mt-24">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <BlogFeedCardSkeleton key={index} />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[36px] border border-dashed border-[#e6d7c7] bg-white/68 px-8 py-16 text-center shadow-[0_20px_56px_rgba(148,163,184,0.08)]">
              <div className="mx-auto max-w-xl space-y-3">
                <h3 className="text-2xl font-semibold text-slate-900">还没有可展示的内容</h3>
                <p className="text-sm leading-8 text-slate-500">
                  新的博客或图文发布后，会优先出现在这里。
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="relative">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-500">
                    第 {currentPage} / {totalPages} 页，按当前排序展示内容。
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full border border-theme-soft-strong bg-white/82 p-1 shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)]">
                      <button
                        type="button"
                        onClick={() => handleSortChange('oldest')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          currentSort === 'oldest'
                            ? 'bg-theme-primary text-white'
                            : 'text-slate-600 hover:bg-theme-soft'
                        }`}
                      >
                        旧到新
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSortChange('newest')}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          currentSort === 'newest'
                            ? 'bg-theme-primary text-white'
                            : 'text-slate-600 hover:bg-theme-soft'
                        }`}
                      >
                        新到旧
                      </button>
                      <span className="px-1 text-slate-400">
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {total > PAGE_SIZE ? (
                      <div className="theme-eyebrow rounded-full border bg-white/82 px-4 py-2 text-sm shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)]">
                        共 {total} 篇内容
                      </div>
                    ) : null}
                  </div>
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
                  title="正在刷新内容..."
                  hint="排序与筛选结果同步中"
                />
              </div>

              {total > PAGE_SIZE ? (
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    className="border-theme-soft-strong rounded-full border bg-white/82 px-5"
                    disabled={currentPage <= 1 || refreshing}
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('page', String(currentPage - 1));
                      setSearchParams(newParams);
                    }}
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
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('page', String(currentPage + 1));
                      setSearchParams(newParams);
                    }}
                  >
                    下一页
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
