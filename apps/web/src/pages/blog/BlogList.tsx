import { BookOpen, FolderTree, Sparkles, Tag, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Group, Post, Tag as TagType } from '@/api/blog';
import { getGroups, getPosts, getTags } from '@/api/blog';
import { BlogFeedCard, TagCloud } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-3">
      <div className="theme-accent-border inline-flex items-center rounded-full border bg-white/82 px-4 py-1.5 text-[11px] tracking-[0.32em] theme-accent-text uppercase shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)] backdrop-blur">
        {eyebrow}
      </div>
      <div className="space-y-2">
        <h2 className="text-[34px] font-semibold tracking-[-0.04em] text-slate-950 md:text-[40px]">
          {title}
        </h2>
        <p className="max-w-2xl text-[15px] leading-8 text-slate-500 md:text-base">{description}</p>
      </div>
    </div>
  );
}

function FilterPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-white/80 bg-white/82 p-5 shadow-[0_18px_42px_rgba(148,163,184,0.08)] backdrop-blur">
      <div className="mb-4 flex items-center gap-2 text-slate-900">
        <span className="theme-chip inline-flex h-9 w-9 items-center justify-center rounded-full">
          {icon}
        </span>
        <span className="text-lg font-semibold">{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function BlogList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const selectedTag = searchParams.get('tag') || '';
  const selectedGroupId = searchParams.get('groupId') || '';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [postsData, groupsData, tagsData] = await Promise.all([
        getPosts({
          page: currentPage,
          pageSize: 12,
          groupId: selectedGroupId || undefined,
          tag: selectedTag || undefined,
        }),
        getGroups(),
        getTags(),
      ]);

      setPosts(postsData.list || []);
      setTotal(postsData.total || 0);
      setGroups(groupsData || []);
      setTags(tagsData || []);
    } catch (error) {
      console.error('Failed to load blog data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedGroupId, selectedTag]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleTagClick = (tagSlug: string) => {
    if (!tagSlug) return;
    const newParams = new URLSearchParams(searchParams);
    if (selectedTag === tagSlug) {
      newParams.delete('tag');
    } else {
      newParams.set('tag', tagSlug);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleGroupClick = (targetGroupId: string) => {
    if (!targetGroupId) return;
    const newParams = new URLSearchParams(searchParams);
    if (selectedGroupId === targetGroupId) {
      newParams.delete('groupId');
    } else {
      newParams.set('groupId', targetGroupId);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const tagCloudData = useMemo(
    () =>
      tags.map((tag) => ({
        name: tag.name,
        count: tag.postCount,
      })),
    [tags],
  );

  const groupData = useMemo(
    () =>
      groups.map((item) => ({
        name: item.name,
        id: item.id,
        count: item.postCount || 0,
      })),
    [groups],
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto max-w-7xl px-6 pb-20 pt-8 md:px-8 lg:px-10">
        <section className="theme-hero-shell relative overflow-hidden rounded-[40px] border px-6 py-8 md:px-10 md:py-10">
          <div className="theme-hero-glow absolute inset-0" />
          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
            <div className="space-y-6">
              <SectionTitle
                eyebrow="UPDATES"
                title="博客与图文"
                description="最近发布的博客、图文和内容分组都会先汇在这里，方便继续浏览和筛选。"
              />
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <BookOpen className="theme-accent-text h-4 w-4" />
                  {total} 篇内容
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <FolderTree className="h-4 w-4 theme-icon-accent" />
                  {groups.length} 个分组
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-sm text-slate-600 shadow-[0_10px_28px_rgba(148,163,184,0.08)]">
                  <Tag className="h-4 w-4 theme-icon-accent" />
                  {tags.length} 个标签
                </div>
              </div>

              {(selectedTag || selectedGroupId) && (
                <div className="rounded-[28px] border border-white/80 bg-white/82 p-4 shadow-[0_16px_40px_rgba(148,163,184,0.08)]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-slate-500">当前筛选</span>
                    {selectedGroupId ? (
                      <span className="theme-tag inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm">
                        <FolderTree className="h-3.5 w-3.5" />
                        {groups.find((g) => g.id === selectedGroupId)?.name || selectedGroupId}
                      </span>
                    ) : null}
                    {selectedTag ? (
                      <span className="theme-tag inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm">
                        <Tag className="h-3.5 w-3.5" />
                        {tags.find((t) => t.slug === selectedTag)?.name || selectedTag}
                      </span>
                    ) : null}
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              <FilterPanel title="内容分组" icon={<FolderTree className="h-4 w-4" />}>
                {groupData.length === 0 ? (
                  <p className="text-sm leading-7 text-slate-500">还没有可用的内容分组。</p>
                ) : (
                  <div className="grid gap-2">
                    {groupData.slice(0, 6).map((group) => (
                      <button
                        type="button"
                        key={group.id}
                        onClick={() => handleGroupClick(group.id)}
                        className={`flex items-center justify-between rounded-[18px] px-3 py-3 text-left text-sm transition ${
                          selectedGroupId === group.id
                            ? 'bg-slate-950 text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]'
                            : 'bg-[#fbfaf8] text-slate-600 hover:bg-white hover:text-slate-950'
                        }`}
                      >
                        <span className="font-medium">{group.name}</span>
                        <span className="text-xs opacity-70">{group.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </FilterPanel>

              <FilterPanel title="标签浏览" icon={<Sparkles className="h-4 w-4" />}>
                {tagCloudData.length === 0 ? (
                  <p className="text-sm leading-7 text-slate-500">还没有可用的标签。</p>
                ) : (
                  <TagCloud
                    tags={tagCloudData}
                    selectedTag={selectedTag}
                    onTagClick={(name) =>
                      handleTagClick(tags.find((t) => t.name === name)?.slug || '')
                    }
                  />
                )}
              </FilterPanel>
            </div>
          </div>
        </section>

        <section className="mt-24">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[420px] rounded-[30px]" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-[36px] border border-dashed border-[#e6d7c7] bg-white/68 px-8 py-16 text-center shadow-[0_20px_56px_rgba(148,163,184,0.08)]">
              <div className="mx-auto max-w-xl space-y-3">
                <h3 className="text-2xl font-semibold text-slate-900">还没有可展示的内容</h3>
                <p className="text-sm leading-8 text-slate-500">
                  新的博客或图文发布后，会先出现在这里。
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="text-sm text-slate-500">
                  第 {currentPage} 页，正在展示最近更新的内容。
                </div>
                {total > 12 ? (
                  <div className="theme-eyebrow rounded-full border bg-white/82 px-4 py-2 text-sm shadow-[0_10px_24px_rgba(var(--theme-primary-rgb),0.08)]">
                    共 {total} 篇内容
                  </div>
                ) : null}
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-[30px] bg-white/68 p-2 shadow-[0_14px_40px_rgba(148,163,184,0.08)]"
                  >
                    <BlogFeedCard post={post} />
                  </div>
                ))}
              </div>

              {total > 12 ? (
                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    className="theme-accent-border rounded-full border bg-white/82 px-5"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('page', String(currentPage - 1));
                      setSearchParams(newParams);
                    }}
                  >
                    上一页
                  </Button>
                  <span className="rounded-full bg-white/82 px-4 py-2 text-sm text-slate-500 shadow-[0_10px_24px_rgba(148,163,184,0.06)]">
                    第 {currentPage} 页
                  </span>
                  <Button
                    variant="outline"
                    className="theme-accent-border rounded-full border bg-white/82 px-5"
                    disabled={posts.length < 12}
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
