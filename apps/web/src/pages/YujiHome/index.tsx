import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      getPosts({ page: 1, pageSize: 4 }),
      getAllResources({ page: 1, pageSize: 6, includeTags: true }),
    ]).then(([postResult, resourceResult]) => {
      if (cancelled) return;
      setPosts(postResult.status === 'fulfilled' ? (postResult.value.list ?? []) : []);
      setResources(resourceResult.status === 'fulfilled' ? (resourceResult.value.list ?? []) : []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredPost = posts[0];
  const recentPosts = posts.slice(1);
  const featuredImages = resources.slice(0, 4);

  return (
    <main className="yuji-public-main yuji-home-page">
      <div className="yuji-loading-surface">
        <BoxLoadingOverlay show={loading} title="正在整理文章与影像" hint="很快就好" />

        <section className="yuji-feature" aria-labelledby="yuji-feature-title">
          <div className="yuji-feature-copy">
            <p className="yuji-kicker">
              <span>当前专题</span>
              <span>{featuredPost?.group?.name || '近来所写'}</span>
            </p>
            <h1 id="yuji-feature-title">{featuredPost?.title || '文字与影像，慢慢留下痕迹。'}</h1>
            <p className="yuji-feature-deck">
              {featuredPost?.excerpt ||
                '雨迹收录技术笔记、正在学习的东西，以及愿意再看一眼的画面。'}
            </p>
            {featuredPost ? (
              <>
                <div className="yuji-meta-row">
                  <span>{featuredPost.group?.name || '文章'}</span>
                  <time>{formatDate(featuredPost.publishedAt || featuredPost.createdAt)}</time>
                </div>
                <Link className="yuji-underlined-link" to={`/articles/${featuredPost.id}`}>
                  阅读全文 <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <Link className="yuji-underlined-link" to="/about">
                关于雨迹 <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>

          <div className="yuji-feature-media">
            {featuredPost?.cover ? (
              <figure className="yuji-feature-cover">
                <img src={featuredPost.cover} alt={`${featuredPost.title}封面`} />
                <figcaption>FEATURE / WRITING</figcaption>
              </figure>
            ) : featuredImages[0] ? (
              <figure className="yuji-feature-cover">
                <img
                  src={featuredImages[0].thumbnailUrl || featuredImages[0].url}
                  alt={featuredImages[0].title}
                />
                <figcaption>FEATURE / IMAGE</figcaption>
              </figure>
            ) : (
              <div className="yuji-feature-placeholder" aria-hidden="true">
                <span>雨</span>
              </div>
            )}
            {featuredImages[1] ? (
              <Link
                className="yuji-feature-secondary"
                to={`/gallery/image/${featuredImages[1].id}`}
              >
                <img
                  src={featuredImages[1].thumbnailUrl || featuredImages[1].url}
                  alt={featuredImages[1].title}
                />
              </Link>
            ) : null}
          </div>
          <span className="yuji-feature-index" aria-hidden="true">
            01
          </span>
        </section>

        <section className="yuji-section" aria-labelledby="yuji-recent-title">
          <header className="yuji-section-heading">
            <p>RECENT WRITING</p>
            <h2 id="yuji-recent-title">近来的文章</h2>
            <Link to="/articles">查看全部</Link>
          </header>
          <div className="yuji-writing-ledger">
            {(recentPosts.length ? recentPosts : posts).slice(0, 3).map((post, index) => (
              <article className="yuji-ledger-item" key={post.id}>
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
                {post.cover ? <img src={post.cover} alt="" /> : null}
                <Link
                  className="yuji-ledger-open"
                  to={`/articles/${post.id}`}
                  aria-label={`阅读${post.title}`}
                >
                  ↗
                </Link>
              </article>
            ))}
            {!loading && posts.length === 0 ? (
              <p className="yuji-empty-copy">文章正在整理，过些时候再来看看。</p>
            ) : null}
          </div>
        </section>

        <section className="yuji-section yuji-home-gallery" aria-labelledby="yuji-gallery-title">
          <header className="yuji-section-heading yuji-gallery-heading">
            <p>CURATED IMAGES</p>
            <h2 id="yuji-gallery-title">风景经过这里</h2>
            <Link to="/gallery">进入图库</Link>
          </header>
          {featuredImages.length ? (
            <div className="yuji-image-composition">
              {featuredImages.map((resource, index) => (
                <figure
                  key={resource.id}
                  className={`yuji-composed-image yuji-composed-image-${index + 1}`}
                >
                  <Link to={`/gallery/image/${resource.id}`}>
                    <img src={resource.thumbnailUrl || resource.url} alt={resource.title} />
                  </Link>
                  <figcaption>{resource.title}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            !loading && <p className="yuji-empty-copy">新的影像还在路上。</p>
          )}
        </section>
      </div>
    </main>
  );
}
