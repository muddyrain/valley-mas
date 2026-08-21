import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPostDetailById, type PostDetail } from '@/api/blog';
import { TableOfContents } from '@/components/blog/TableOfContents';
import YujiArticleMarkdownContent from '@/components/yuji/YujiArticleMarkdownContent';
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
  const [activeTocId, setActiveTocId] = useState('');
  const showToc = toc.length >= 2 || content.length > 2400;
  const readingMinutes = Math.max(1, Math.ceil(content.replace(/\s/g, '').length / 420));
  const showLoading = useDelayedLoading(loading);

  useEffect(() => {
    setActiveTocId(toc[0]?.id ?? '');
  }, [toc]);

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
              <span aria-hidden="true">←</span> 返回文章索引
            </Link>
            <p className="yuji-article-signal" aria-hidden="true">
              YJ / ARTICLE
              <br />
              READ MODE / QUIET
            </p>
            <div className="yuji-article-title">
              <p className="yuji-meta-row">
                <span>{post.group?.name || '文章'}</span>
                <time>{formatDate(post.publishedAt || post.createdAt)}</time>
                <span>{readingMinutes} 分钟阅读</span>
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

          <div className={`yuji-article-layout ${showToc ? 'has-toc' : 'has-no-toc'}`}>
            {showToc ? (
              <aside className="yuji-article-toc" aria-label="文章目录">
                <TableOfContents
                  activeId={activeTocId}
                  className="yuji-article-toc-list"
                  onActiveIdChange={setActiveTocId}
                  toc={toc}
                />
              </aside>
            ) : null}
            <YujiArticleMarkdownContent html={renderedContent} />
          </div>

          <footer className="yuji-article-footer">
            {post.tags?.length ? (
              <div className="yuji-article-tags" role="list" aria-label="文章标签">
                {post.tags.map((tag) => (
                  <span key={tag.id} role="listitem">
                    {tag.name}
                  </span>
                ))}
              </div>
            ) : null}
            {post.prevPost || post.nextPost ? (
              <nav className="yuji-article-neighbors" aria-label="相邻文章">
                {post.prevPost ? (
                  <Link
                    className="yuji-article-neighbor yuji-article-neighbor--previous"
                    to={`/articles/${post.prevPost.id}`}
                  >
                    <span className="yuji-article-neighbor-label">
                      <i aria-hidden="true">←</i>
                      上一篇
                    </span>
                    <strong>{post.prevPost.title}</strong>
                  </Link>
                ) : null}
                {post.nextPost ? (
                  <Link
                    className="yuji-article-neighbor yuji-article-neighbor--next"
                    to={`/articles/${post.nextPost.id}`}
                  >
                    <span className="yuji-article-neighbor-label">
                      下一篇
                      <i aria-hidden="true">→</i>
                    </span>
                    <strong>{post.nextPost.title}</strong>
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </footer>
        </article>
      ) : null}
    </main>
  );
}
