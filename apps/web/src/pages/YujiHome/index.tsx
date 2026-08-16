import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import YujiLiquidRainStage from '@/components/yuji/YujiLiquidRainStage';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useYujiEditorialMotion } from '@/hooks/useYujiEditorialMotion';

function formatDate(value?: string) {
  if (!value) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date(value))
    .replace(/\//g, '.');
}

export default function YujiHome() {
  const pageRef = useRef<HTMLElement>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingResources, setLoadingResources] = useState(true);
  const [postsFailed, setPostsFailed] = useState(false);
  const [resourcesFailed, setResourcesFailed] = useState(false);
  const postsRequestRef = useRef(0);
  const resourcesRequestRef = useRef(0);

  const loadPosts = useCallback(() => {
    const requestId = ++postsRequestRef.current;
    setLoadingPosts(true);
    setPostsFailed(false);
    return getPosts({ page: 1, pageSize: 3 })
      .then((data) => {
        if (requestId === postsRequestRef.current) setPosts(data.list ?? []);
      })
      .catch(() => {
        if (requestId === postsRequestRef.current) {
          setPosts([]);
          setPostsFailed(true);
        }
      })
      .finally(() => {
        if (requestId === postsRequestRef.current) setLoadingPosts(false);
      });
  }, []);

  const loadResources = useCallback(() => {
    const requestId = ++resourcesRequestRef.current;
    setLoadingResources(true);
    setResourcesFailed(false);
    return getAllResources({ page: 1, pageSize: 6, includeTags: true, type: 'wallpaper' })
      .then((data) => {
        if (requestId === resourcesRequestRef.current) setResources(data.list ?? []);
      })
      .catch(() => {
        if (requestId === resourcesRequestRef.current) {
          setResources([]);
          setResourcesFailed(true);
        }
      })
      .finally(() => {
        if (requestId === resourcesRequestRef.current) setLoadingResources(false);
      });
  }, []);

  useEffect(() => {
    void loadPosts();
    void loadResources();

    return () => {
      postsRequestRef.current += 1;
      resourcesRequestRef.current += 1;
    };
  }, [loadPosts, loadResources]);

  const showPostsLoading = useDelayedLoading(loadingPosts);
  const showResourcesLoading = useDelayedLoading(loadingResources);

  const recentPosts = posts.slice(0, 3);
  const featuredImages = resources.slice(0, 6);
  const motionRevision = `${loadingPosts}-${loadingResources}-${posts.length}-${resources.length}`;
  useYujiEditorialMotion(pageRef, motionRevision);

  return (
    <main ref={pageRef} className="yuji-home-page">
      <YujiLiquidRainStage />

      <div className="yuji-public-main yuji-home-content">
        <section className="yuji-section" aria-labelledby="yuji-recent-title">
          <header className="yuji-section-heading" data-yuji-reveal="scroll">
            <p>RECENT WRITING</p>
            <h2 id="yuji-recent-title">近来的文章</h2>
            <Link to="/articles">查看全部</Link>
          </header>
          <div className="yuji-writing-ledger">
            {recentPosts.map((post, index) => (
              <article className="yuji-ledger-item" key={post.id} data-yuji-reveal="scroll">
                <span className="yuji-ledger-number">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <p className="yuji-meta-row">
                    <span>{post.group?.name || '文章'}</span>
                    <time>{formatDate(post.publishedAt || post.createdAt)}</time>
                  </p>
                  <h3>
                    <Link to={`/articles/${post.id}`}>{post.title}</Link>
                  </h3>
                  <p>{post.excerpt}</p>
                </div>
                {post.cover ? (
                  <img src={post.cover} alt="" decoding="async" loading="lazy" />
                ) : null}
                <Link
                  className="yuji-ledger-open"
                  to={`/articles/${post.id}`}
                  aria-label={`阅读${post.title}`}
                >
                  ↗
                </Link>
              </article>
            ))}
            {showPostsLoading ? (
              <YujiContentRevealStatus label="文章正在显影" variant="writing" />
            ) : null}
            {!loadingPosts && posts.length === 0 ? (
              <YujiContentState
                message={postsFailed ? '文章暂时没有抵达。' : '文章正在整理，过些时候再来看看。'}
                onRetry={postsFailed ? () => void loadPosts() : undefined}
              />
            ) : null}
          </div>
        </section>

        <section className="yuji-section yuji-home-gallery" aria-labelledby="yuji-gallery-title">
          <header className="yuji-section-heading yuji-gallery-heading" data-yuji-reveal="scroll">
            <p>CURATED IMAGES</p>
            <h2 id="yuji-gallery-title">风景经过这里</h2>
            <Link to="/gallery">进入图库</Link>
          </header>
          {featuredImages.length ? (
            <div className="yuji-home-image-grid">
              {featuredImages.map((resource, index) => (
                <figure
                  key={resource.id}
                  className={index === 0 ? 'yuji-home-image-item is-lead' : 'yuji-home-image-item'}
                  data-yuji-reveal="scroll"
                >
                  <Link to={`/gallery/image/${resource.id}`}>
                    <img
                      src={resource.thumbnailUrl || resource.url}
                      alt={resource.title}
                      decoding="async"
                      loading="lazy"
                    />
                  </Link>
                  <figcaption>{resource.title}</figcaption>
                </figure>
              ))}
            </div>
          ) : loadingResources ? (
            showResourcesLoading ? (
              <YujiContentRevealStatus label="影像正在显影" variant="gallery" />
            ) : null
          ) : (
            <YujiContentState
              message={resourcesFailed ? '影像暂时没有抵达。' : '新的影像还在路上。'}
              onRetry={resourcesFailed ? () => void loadResources() : undefined}
            />
          )}
        </section>

        <section className="yuji-home-about" aria-labelledby="yuji-home-about-title">
          <p>ABOUT / MUDDYRAIN</p>
          <div>
            <h2 id="yuji-home-about-title">关于</h2>
            <p>技术判断、影像练习，以及仍在发生的思考。</p>
          </div>
          <Link className="yuji-underlined-link" to="/about">
            继续了解 <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
