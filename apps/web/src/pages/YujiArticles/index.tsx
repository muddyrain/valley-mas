import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Group, getGroups, getPosts, type Post } from '@/api/blog';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getPosts({ page: 1, pageSize: 12, ...(groupId ? { groupId } : {}) })
      .then((data) => {
        if (!cancelled) setPosts(data.list ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setPosts([]);
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return (
    <main className="yuji-public-main yuji-index-page">
      <header className="yuji-index-hero">
        <p className="yuji-index-label">
          <span>WRITING</span>
          <span>技术与实践</span>
        </p>
        <h1>文章</h1>
        <p>关于 React、TypeScript、AI 与正在学习的东西。按专栏整理，也保留理解发生变化的痕迹。</p>
      </header>

      <nav className="yuji-filter-bar" aria-label="文章专栏">
        <span>按专栏阅读</span>
        <div>
          <Link to="/articles" aria-current={!groupId ? 'true' : undefined}>
            全部
          </Link>
          {groups.map((group) => (
            <Link
              key={group.id}
              to={`/articles?groupId=${encodeURIComponent(group.id)}`}
              aria-current={groupId === group.id ? 'true' : undefined}
            >
              {group.name}
            </Link>
          ))}
        </div>
      </nav>

      <section className="yuji-writing-index yuji-loading-surface" aria-label="文章列表">
        <BoxLoadingOverlay show={loading} title="正在翻阅文章" hint="很快就好" />
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
                <img src={post.cover} alt={`${post.title}封面`} />
              </figure>
            ) : (
              <div />
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
          <p className="yuji-empty-copy">
            {failed ? '文章暂时无法加载，请稍后再试。' : '这个专栏还没有公开文章。'}
          </p>
        ) : null}
      </section>
    </main>
  );
}
