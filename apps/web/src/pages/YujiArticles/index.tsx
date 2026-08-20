import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Group, getGroups, getPosts, type Post } from '@/api/blog';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import YujiStageArticleCard from '@/components/yuji/YujiStageArticleCard';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';

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
          <span>WRITING / LIVE INDEX</span>
          <span>YJ.ARTICLES — 2026</span>
        </p>
        <h1>
          <span>文章</span>
          <small>ARTICLE SIGNALS</small>
        </h1>
        <p>技术、工具与实践中的真实判断。每一次打开，都从同一张封面穿过，抵达安静的正文。</p>
        <div className="yuji-index-coordinate" aria-hidden="true">
          <span>INDEX / {String(posts.length).padStart(2, '0')}</span>
          <span>SCROLL VELOCITY / LIVE</span>
        </div>
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

      <section
        className="yuji-writing-index yuji-stage-article-grid"
        aria-label="文章列表"
        aria-busy={loading}
      >
        {showLoading ? <YujiContentRevealStatus label="文章正在显影" variant="writing" /> : null}
        {posts.map((post, index) => (
          <YujiStageArticleCard index={index} key={post.id} post={post} scope="index" />
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
