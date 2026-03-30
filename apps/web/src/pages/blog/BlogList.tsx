import { BookOpen, FolderTree, Tag, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Group, Post, Tag as TagType } from '@/api/blog';
import { getGroups, getPosts, getTags } from '@/api/blog';
import { BlogFeedCard, TagCloud } from '@/components/blog';
import { Button } from '@/components/ui/button';

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

  const tagCloudData = useMemo(() => {
    return tags.map((tag) => ({
      name: tag.name,
      count: tag.postCount,
    }));
  }, [tags]);

  const groupData = useMemo(() => {
    return groups.map((item) => ({
      name: item.name,
      id: item.id,
      count: item.postCount || 0,
    }));
  }, [groups]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-b from-primary/5 to-background border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
              <BookOpen className="w-10 h-10 text-primary" />
              博客与图文广场
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              记录创作、分享思考，也可以浏览图文灵感。
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            {(selectedTag || selectedGroupId) && (
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">当前筛选</span>
                {selectedGroupId && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                    <FolderTree className="w-3 h-3" />
                    {groups.find((g) => g.id === selectedGroupId)?.name || selectedGroupId}
                  </span>
                )}
                {selectedTag && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                    <Tag className="w-3 h-3" />
                    {tags.find((t) => t.slug === selectedTag)?.name || selectedTag}
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="w-3 h-3" />
                  清空
                </Button>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">暂无文章</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {posts.map((post) => (
                    <BlogFeedCard key={post.id} post={post} />
                  ))}
                </div>

                {total > 12 && (
                  <div className="mt-8 flex justify-center gap-2">
                    <Button
                      variant="outline"
                      disabled={currentPage <= 1}
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', String(currentPage - 1));
                        setSearchParams(newParams);
                      }}
                    >
                      上一页
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      第 {currentPage} 页
                    </span>
                    <Button
                      variant="outline"
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
                )}
              </>
            )}
          </div>

          <aside className="w-full lg:w-80 space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-primary" />
                分组
              </h3>
              {groupData.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无分组</p>
              ) : (
                <div className="space-y-2">
                  {groupData.map((group) => (
                    <button
                      type="button"
                      key={group.id}
                      onClick={() => handleGroupClick(group.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedGroupId === group.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{group.name}</span>
                      <span className="text-xs opacity-70">{group.count}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card rounded-xl p-6 border border-border/50">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                标签云
              </h3>
              {tagCloudData.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无标签</p>
              ) : (
                <TagCloud
                  tags={tagCloudData}
                  selectedTag={selectedTag}
                  onTagClick={(name) =>
                    handleTagClick(tags.find((t) => t.name === name)?.slug || '')
                  }
                />
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
