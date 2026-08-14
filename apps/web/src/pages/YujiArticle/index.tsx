import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPostDetailById, type PostDetail } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { extractToc, renderMarkdownWithAnchors } from '@/utils/blog';

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date(value));
}

function withoutRepeatedMarkdownTitle(content: string, title: string) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const firstContentLine = lines.findIndex((line) => line.trim().length > 0);
  if (firstContentLine < 0) return content;

  const heading = lines[firstContentLine].match(/^#\s+(.+?)\s*#*\s*$/);
  if (!heading || heading[1].trim() !== title.trim()) return content;

  lines.splice(0, firstContentLine + 1);
  while (lines[0]?.trim() === '') lines.shift();
  return lines.join('\n');
}

export default function YujiArticle() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getPostDetailById(id, { suppressErrorToast: true })
      .then((data) => {
        if (!cancelled) setPost(data);
      })
      .catch(() => {
        if (!cancelled) setPost(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (post?.title) document.title = `${post.title} | 雨迹`;
  }, [post?.title]);

  const rawContent = post?.content || post?.htmlContent || '';
  const content = post ? withoutRepeatedMarkdownTitle(rawContent, post.title) : rawContent;
  const toc = useMemo(() => extractToc(content), [content]);
  const renderedContent = useMemo(() => renderMarkdownWithAnchors(content), [content]);

  if (!loading && !post) {
    return (
      <main className="yuji-public-main yuji-missing-page">
        <p>这篇文章暂时无法打开。</p>
        <Link className="yuji-underlined-link" to="/articles">
          返回文章
        </Link>
      </main>
    );
  }

  return (
    <main className="yuji-article-page yuji-loading-surface">
      <BoxLoadingOverlay show={loading} title="正在打开文章" hint="很快就好" />
      {post ? (
        <article>
          <header className="yuji-article-hero">
            <Link className="yuji-back-link" to="/articles">
              ← 返回文章
            </Link>
            <div className="yuji-article-title">
              <p className="yuji-meta-row">
                <span>{post.group?.name || '文章'}</span>
                <time>{formatDate(post.publishedAt || post.createdAt)}</time>
              </p>
              <h1>{post.title}</h1>
              {post.excerpt ? <p>{post.excerpt}</p> : null}
              <a
                className="yuji-article-author"
                href="https://github.com/muddyrain"
                target="_blank"
                rel="noreferrer"
              >
                by @muddyrain ↗
              </a>
            </div>
            {post.cover ? (
              <figure>
                <img src={post.cover} alt={`${post.title}封面`} />
              </figure>
            ) : null}
          </header>

          <div className="yuji-article-layout">
            <aside className="yuji-article-toc" aria-label="文章目录">
              <p>目录</p>
              {toc.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  {item.text}
                </a>
              ))}
            </aside>
            <div
              className="yuji-article-body"
              // Blog content is authored by the single site owner and rendered through the existing pipeline.
              dangerouslySetInnerHTML={{ __html: renderedContent }}
            />
            <aside className="yuji-article-note">
              <span>NOTE</span>
              <p>在需要时记录，在理解变化后回来修订。</p>
            </aside>
          </div>

          {post.tags?.length ? (
            <footer className="yuji-article-tags">
              {post.tags.map((tag) => (
                <span key={tag.id}>{tag.name}</span>
              ))}
            </footer>
          ) : null}
        </article>
      ) : null}
    </main>
  );
}
