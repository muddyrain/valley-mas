import { ArrowLeft, Calendar, ChevronLeft, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PostDetail } from '@/api/blog';
import { getPostDetail } from '@/api/blog';
import { MarkdownContent, TableOfContents } from '@/components/blog';
import { Button } from '@/components/ui/button';
import type { TocItem } from '@/utils/blog';
import { extractToc, formatDate, renderMarkdown } from '@/utils/blog';

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState('');

  useEffect(() => {
    if (slug) {
      loadPost(slug);
    }
  }, [slug]);

  const loadPost = async (postSlug: string) => {
    setLoading(true);
    try {
      const res = await getPostDetail(postSlug);
      if (res.code === 0 && res.data) {
        setPost(res.data);
        // 如果后端已经渲染了 HTML，直接使用；否则前端渲染
        const html = res.data.htmlContent || renderMarkdown(res.data.content);
        setHtmlContent(html);
        setToc(extractToc(res.data.content));
      }
    } catch (error) {
      console.error('Failed to load post:', error);
    } finally {
      setLoading(false);
    }
  };

  const processedContent = htmlContent.replace(/<h([1-6])>([^<]+)<\/h[1-6]>/g, (_, level, text) => {
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    return `<h${level} id="${id}">${text}</h${level}>`;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-64 bg-muted rounded mt-8" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">文章未找到</h1>
          <p className="text-muted-foreground mb-6">抱歉，您访问的文章不存在。</p>
          <Link to="/blog">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回博客列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <Link
            to="/blog"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回博客
          </Link>
        </div>
      </div>

      {/* 文章头部 */}
      <header className="pt-12 pb-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* 分类标签 */}
          {post.category && (
            <div className="mb-6">
              <Link
                to={`/blog?category=${encodeURIComponent(post.category.slug)}`}
                className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all"
              >
                {post.category.name}
              </Link>
            </div>
          )}

          {/* 标题 */}
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-6 leading-tight">
            {post.title}
          </h1>

          {/* 元信息 */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <time>{formatDate(post.publishedAt || post.createdAt)}</time>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>阅读约 {Math.ceil(post.content.length / 500)} 分钟</span>
            </div>
            {post.viewCount > 0 && (
              <div className="flex items-center gap-2">
                <span>👁 {post.viewCount} 次浏览</span>
              </div>
            )}
          </div>

          {/* 标签 */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors px-3 py-1 rounded-full hover:bg-muted"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* 文章内容区域 */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* 目录侧边栏 */}
          {toc.length > 0 && (
            <aside className="hidden lg:block lg:w-64 lg:flex-shrink-0">
              <div className="sticky top-24">
                <div className="bg-card rounded-xl p-5 border border-border/50 shadow-sm">
                  <TableOfContents toc={toc} />
                </div>
              </div>
            </aside>
          )}

          {/* 正文内容 */}
          <main className="flex-1 min-w-0 max-w-3xl lg:max-w-2xl mx-auto lg:mx-0">
            <MarkdownContent content={processedContent} />

            {/* 文章底部 */}
            <div className="mt-16 pt-8 border-t border-border flex items-center justify-between">
              <Link to="/blog">
                <Button
                  variant="ghost"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                  返回列表
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
