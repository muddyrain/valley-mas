import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPostDetailById, type PostDetail } from '@/api/blog';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
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
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);

  const loadPost = useCallback(() => {
    if (!id) return Promise.resolve();
    const requestId = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    setPost(null);
    return getPostDetailById(id, { suppressErrorToast: true })
      .then((data) => {
        if (requestId === requestRef.current) setPost(data);
      })
      .catch(() => {
        if (requestId === requestRef.current) {
          setPost(null);
          setFailed(true);
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    void loadPost();
    return () => {
      requestRef.current += 1;
    };
  }, [loadPost]);

  useEffect(() => {
    if (post?.title) document.title = `${post.title} | 雨迹`;
  }, [post?.title]);

  const rawContent = post?.content || post?.htmlContent || '';
  const content = post ? withoutRepeatedMarkdownTitle(rawContent, post.title) : rawContent;
  const toc = useMemo(() => extractToc(content), [content]);
  const renderedContent = useMemo(() => renderMarkdownWithAnchors(content), [content]);
  const showLoading = useDelayedLoading(loading);

  if (!loading && !post) {
    return (
      <main className="yuji-public-main yuji-missing-page">
        <YujiContentState
          message={failed ? '这篇文章暂时没有抵达。' : '这篇文章已经不在这里了。'}
          onRetry={failed ? () => void loadPost() : undefined}
        />
        <Link className="yuji-underlined-link" to="/articles">
          返回文章
        </Link>
      </main>
    );
  }

  return (
    <main className="yuji-article-page" aria-busy={loading}>
      {showLoading ? (
        <YujiContentRevealStatus
          className="yuji-article-reveal"
          label="文章正在显影"
          variant="article"
        />
      ) : null}
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
