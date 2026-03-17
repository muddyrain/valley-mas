import { ArrowLeft, Calendar, ChevronLeft, Clock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PostDetail } from '@/api/blog';
import { getPostDetailById } from '@/api/blog';
import { MarkdownContent, TableOfContents } from '@/components/blog';
import { Button } from '@/components/ui/button';
import { extractToc, formatDate, renderMarkdown, type TocItem } from '@/utils/blog';

export default function BlogPost() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void loadPost(id);
  }, [id]);

  const loadPost = async (postId: string) => {
    setLoading(true);
    try {
      const data = await getPostDetailById(postId);
      setPost(data);
      setToc(extractToc(data.content || ''));
    } catch (error) {
      console.error('Failed to load post:', error);
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  const processedContent = useMemo(() => {
    if (!post) return '';
    const html = renderMarkdown(post.content || post.htmlContent || '');
    return html.replace(/<h([1-6])>([^<]+)<\/h[1-6]>/g, (_, level, text) => {
      const headingId = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      return `<h${level} id="${headingId}">${text}</h${level}>`;
    });
  }, [post]);

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
          <p className="mb-6 text-muted-foreground">你访问的文章不存在或已下线。</p>
          <Link to="/blog">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回博客列表
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/20 via-background to-background">
      <div className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
          <Link
            to="/blog"
            className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回博客列表
          </Link>
        </div>
      </div>

      <header className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm sm:p-10">
          {post.category && (
            <Link
              to={`/blog?category=${encodeURIComponent(post.category.slug)}`}
              className="mb-5 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {post.category.name}
            </Link>
          )}

          <h1 className="max-w-4xl text-3xl font-bold leading-tight text-foreground sm:text-5xl">
            {post.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
            <div className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <time>{formatDate(post.publishedAt || post.createdAt)}</time>
            </div>
            <div className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>预计阅读 {Math.max(1, Math.ceil((post.content || '').length / 500))} 分钟</span>
            </div>
            {post.viewCount > 0 && <span>{post.viewCount} 次阅读</span>}
          </div>

          {!!post.cover && (
            <div className="mt-8 overflow-hidden rounded-xl border border-border/60">
              <img src={post.cover} alt={post.title} className="h-52 w-full object-cover sm:h-72" />
            </div>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  to={`/blog?tag=${encodeURIComponent(tag.slug)}`}
                  className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
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
              <Link to="/blog">
                <Button variant="ghost" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
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
