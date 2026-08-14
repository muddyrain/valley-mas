import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Group, getGroups, getPosts, type Post } from '@/api/blog';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value));
}

export default function YujiArticles() {
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('groupId') || '';
  const [groups, setGroups] = useState<Group[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getGroups()
      .then((data) => {
        if (!cancelled) setGroups(data ?? []);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPosts = useCallback(() => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    setPosts([]);
    return getPosts({ page: 1, pageSize: 12, ...(groupId ? { groupId } : {}) })
      .then((data) => {
        if (requestId === requestRef.current) setPosts(data.list ?? []);
      })
      .catch(() => {
        if (requestId === requestRef.current) {
          setPosts([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (requestId === requestRef.current) setLoading(false);
      });
  }, [groupId]);

  useEffect(() => {
    void loadPosts();
    return () => {
      requestRef.current += 1;
    };
  }, [loadPosts]);

  const showLoading = useDelayedLoading(loading);

  return (
    <main className="yuji-public-main yuji-index-page yuji-articles-page">
      <header className="yuji-index-hero yuji-articles-hero">
        <p className="yuji-index-label">
          <span>WRITING</span>
          <span>技术与实践</span>
        </p>
        <h1>文章</h1>
        <p>关于 React、TypeScript、AI 与正在学习的东西。按专栏整理，也保留理解发生变化的痕迹。</p>
      </header>

      <nav className="yuji-column-rail" aria-label="文章专栏">
        <div className="yuji-column-rail-heading" aria-hidden="true">
          <span>COLUMNS</span>
          <strong>专栏</strong>
        </div>
        <div className="yuji-column-track">
          <Link to="/articles" aria-current={!groupId ? 'page' : undefined}>
            全部文章
          </Link>
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/articles?groupId=${encodeURIComponent(group.id)}`}
              aria-current={groupId === group.id ? 'page' : undefined}
            >
              {group.name}
            </Link>
          ))}
        </div>
      </nav>

      <section className="yuji-writing-index" aria-label="文章列表" aria-busy={loading}>
        {showLoading ? <YujiContentRevealStatus label="文章正在显影" variant="writing" /> : null}
        {posts.map((post, index) => (
          <article className="yuji-writing-index-item" key={post.id}>
            <span className="yuji-writing-number">{String(index + 1).padStart(2, '0')}</span>
            <div className="yuji-writing-copy">
              <p className="yuji-meta-row">
                <span>{post.group?.name || '文章'}</span>
                <time>{formatDate(post.publishedAt || post.createdAt)}</time>
              </p>
              <h2>
                <Link to={`/articles/${post.id}`}>{post.title}</Link>
              </h2>
              <p>{post.excerpt}</p>
            </div>
            {post.cover ? (
              <figure>
                <Link to={`/articles/${post.id}`} aria-label={`阅读${post.title}`}>
                  <img
                    src={post.cover}
                    alt={`${post.title}封面`}
                    decoding="async"
                    fetchPriority={index < 2 ? 'high' : 'auto'}
                    loading={index < 2 ? 'eager' : 'lazy'}
                  />
                </Link>
              </figure>
            ) : (
              <div className="yuji-writing-cover-placeholder" aria-hidden="true" />
            )}
            <Link
              className="yuji-writing-open"
              to={`/articles/${post.id}`}
              aria-label={`阅读${post.title}`}
            >
              ↗
            </Link>
          </article>
        ))}
        {!loading && posts.length === 0 ? (
          <YujiContentState
            message={failed ? '文章暂时没有抵达。' : '这个专栏还没有公开文章。'}
            onRetry={failed ? () => void loadPosts() : undefined}
          />
        ) : null}
      </section>
    </main>
  );
}
