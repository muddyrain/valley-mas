import { BookOpen, Folder, Tag, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Category, Post, Tag as TagType } from '@/api/blog';
import { getCategories, getPosts, getTags } from '@/api/blog';
import { PostCard, TagCloud } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/blog';

export default function BlogList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const selectedTag = searchParams.get('tag') || '';
  const selectedCategory = searchParams.get('category') || '';
  const currentPage = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    loadData();
  }, [selectedTag, selectedCategory, currentPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 并行加载数据
      const [postsRes, categoriesRes, tagsRes] = await Promise.all([
        getPosts({
          page: currentPage,
          pageSize: 12,
          category: selectedCategory,
          tag: selectedTag,
        }),
        getCategories(),
        getTags(),
      ]);

      if (postsRes.code === 0) {
        setPosts(postsRes.data);
        setTotal(postsRes.total);
      }
      if (categoriesRes.code === 0) {
        setCategories(categoriesRes.data);
      }
      if (tagsRes.code === 0) {
        setTags(tagsRes.data);
      }
    } catch (error) {
      console.error('Failed to load blog data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagClick = (tagSlug: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedTag === tagSlug) {
      newParams.delete('tag');
    } else {
      newParams.set('tag', tagSlug);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleCategoryClick = (categorySlug: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (selectedCategory === categorySlug) {
      newParams.delete('category');
    } else {
      newParams.set('category', categorySlug);
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // 转换标签格式
  const tagCloudData = useMemo(() => {
    return tags.map((tag) => ({
      name: tag.name,
      count: tag.postCount,
    }));
  }, [tags]);

  // 转换分类格式
  const categoryData = useMemo(() => {
    return categories.map((cat) => ({
      name: cat.name,
      count: cat.postCount,
    }));
  }, [categories]);

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
              我的博客
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              记录技术成长，分享生活感悟
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1">
            {(selectedTag || selectedCategory) && (
              <div className="mb-6 flex items-center gap-3">
                <span className="text-sm text-muted-foreground">当前筛选:</span>
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                    <Folder className="w-3 h-3" />
                    {categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}
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
                  清除筛选
                </Button>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">暂无文章</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={{
                        slug: post.slug,
                        title: post.title,
                        excerpt: post.excerpt,
                        date: formatDate(post.publishedAt || post.createdAt),
                        category: post.category?.name || '未分类',
                        tags: post.tags?.map((t) => t.name) || [],
                        cover: post.cover,
                      }}
                    />
                  ))}
                </div>

                {/* 分页 */}
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
                <Folder className="w-5 h-5 text-primary" />
                分类
              </h3>
              {categoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground">暂无分类</p>
              ) : (
                <div className="space-y-2">
                  {categoryData.map((category) => (
                    <button
                      type="button"
                      key={category.name}
                      onClick={() =>
                        handleCategoryClick(
                          categories.find((c) => c.name === category.name)?.slug || '',
                        )
                      }
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedCategory === categories.find((c) => c.name === category.name)?.slug
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <span>{category.name}</span>
                      <span className="text-xs opacity-70">{category.count}</span>
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
