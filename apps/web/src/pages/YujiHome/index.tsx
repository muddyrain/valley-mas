import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
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
    return getPosts({ page: 1, pageSize: 4 })
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

  const featuredPost = posts[0];
  const recentPosts = posts.slice(1);
  const featuredImages = resources.slice(0, 3);
  const loadingLabel =
    loadingPosts && loadingResources
      ? '文章与影像正在显影'
      : loadingPosts
        ? '文字正在显影'
        : loadingResources
          ? '影像正在显影'
          : '';
  const motionRevision = `${loadingPosts}-${loadingResources}-${posts.length}-${resources.length}`;
  useYujiEditorialMotion(pageRef, motionRevision);

  return (
    <main ref={pageRef} className="yuji-public-main yuji-home-page">
      <section
        className="yuji-feature"
        aria-label={loadingPosts ? '首页重点内容' : undefined}
        aria-labelledby={loadingPosts ? undefined : 'yuji-feature-title'}
      >
        {loadingPosts ? (
          <div className="yuji-feature-copy yuji-feature-copy-pending">
            {showPostsLoading ? (
              <YujiContentRevealStatus label={loadingLabel} variant="feature" />
            ) : null}
          </div>
        ) : (
          <div className="yuji-feature-copy">
            <p className="yuji-kicker" data-yuji-reveal="intro">
              <span>当前专题</span>
              <span>{featuredPost?.group?.name || '近来所写'}</span>
            </p>
            <h1 id="yuji-feature-title" data-yuji-reveal="intro">
              {featuredPost?.title || '文字与影像，慢慢留下痕迹。'}
            </h1>
            <p className="yuji-feature-deck" data-yuji-reveal="intro">
              {featuredPost?.excerpt ||
                '雨迹收录技术笔记、正在学习的东西，以及愿意再看一眼的画面。'}
            </p>
            {featuredPost ? (
              <div data-yuji-reveal="intro">
                <div className="yuji-meta-row">
                  <span>{featuredPost.group?.name || '文章'}</span>
                  <time>{formatDate(featuredPost.publishedAt || featuredPost.createdAt)}</time>
                </div>
                <Link className="yuji-underlined-link" to={`/articles/${featuredPost.id}`}>
                  阅读全文 <span aria-hidden="true">→</span>
                </Link>
              </div>
            ) : (
              <Link className="yuji-underlined-link" to="/about" data-yuji-reveal="intro">
                关于雨迹 <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        )}

        <div className="yuji-feature-media">
          {loadingPosts ? (
            showPostsLoading ? (
              <YujiContentRevealStatus
                className="yuji-feature-media-reveal"
                label={loadingLabel}
                variant="images"
              />
            ) : null
          ) : featuredPost?.cover ? (
            <figure className="yuji-feature-cover" data-yuji-reveal="media">
              <img
                src={featuredPost.cover}
                alt={`${featuredPost.title}封面`}
                decoding="async"
                fetchPriority="high"
                loading="eager"
              />
              <figcaption>FEATURE / WRITING</figcaption>
            </figure>
          ) : !featuredPost && featuredImages[0] ? (
            <figure className="yuji-feature-cover" data-yuji-reveal="media">
              <img
                src={featuredImages[0].thumbnailUrl || featuredImages[0].url}
                alt={featuredImages[0].title}
                decoding="async"
                fetchPriority="high"
                loading="eager"
              />
              <figcaption>FEATURE / IMAGE</figcaption>
            </figure>
          ) : loadingResources ? (
            showResourcesLoading ? (
              <YujiContentRevealStatus
                className="yuji-feature-media-reveal"
                label={loadingLabel}
                variant="images"
              />
            ) : null
          ) : (
            <div className="yuji-feature-placeholder" aria-hidden="true">
              <span className="yuji-feature-placeholder-line" />
            </div>
          )}
        </div>
        <span className="yuji-feature-index" aria-hidden="true">
          01
        </span>
      </section>

      <section className="yuji-section" aria-labelledby="yuji-recent-title">
        <header className="yuji-section-heading" data-yuji-reveal="scroll">
          <p>RECENT WRITING</p>
          <h2 id="yuji-recent-title">近来的文章</h2>
          <Link to="/articles">查看全部</Link>
        </header>
        <div className="yuji-writing-ledger">
          {(recentPosts.length ? recentPosts : posts).slice(0, 3).map((post, index) => (
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
              {post.cover ? <img src={post.cover} alt="" decoding="async" loading="lazy" /> : null}
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
    </main>
  );
}
