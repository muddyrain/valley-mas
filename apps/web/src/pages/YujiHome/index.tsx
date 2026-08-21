import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import YujiContentRevealStatus from '@/components/yuji/YujiContentRevealStatus';
import YujiContentState from '@/components/yuji/YujiContentState';
import YujiStageArticleCard from '@/components/yuji/YujiStageArticleCard';
import YujiWordmarkHero from '@/components/yuji/YujiWordmarkHero';
import { YUJI_GITHUB_AVATAR_URL, YUJI_GITHUB_PROFILE_URL } from '@/components/yuji/yujiAuthor';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useYujiEditorialMotion } from '@/hooks/useYujiEditorialMotion';

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
    return getPosts({ page: 1, pageSize: 8 })
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
    return getAllResources({ page: 1, pageSize: 4, includeTags: true, type: 'wallpaper' })
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

  const recentPosts = posts.slice(0, 8);
  const featuredImages = resources.slice(0, 4);
  const motionRevision = `${loadingPosts}-${loadingResources}-${posts.length}-${resources.length}`;
  useYujiEditorialMotion(pageRef, motionRevision);

  return (
    <main ref={pageRef} className="yuji-home-page">
      <YujiWordmarkHero />

      <div className="yuji-public-main yuji-home-content">
        <section className="yuji-home-statement" aria-labelledby="yuji-statement-title">
          <p className="yuji-profile-kicker">YJ / PROFILE NOTE 01</p>
          <a
            className="yuji-profile-portrait"
            href={YUJI_GITHUB_PROFILE_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="访问 muddyrain 的 GitHub 主页"
          >
            <figure>
              <img src={YUJI_GITHUB_AVATAR_URL} alt="muddyrain 的 GitHub 头像" />
              <figcaption>
                <span>@MUDDYRAIN</span>
                <span>HANGZHOU / CN</span>
              </figcaption>
            </figure>
          </a>
          <div className="yuji-profile-copy">
            <p>DEVELOPER / WRITER / VISUAL COLLECTOR</p>
            <h2 id="yuji-statement-title">
              <span className="is-lead">把工程做成表达，</span>
              <span>把兴趣积累成作品。</span>
            </h2>
            <p className="yuji-profile-intro">
              我是 muddyrain，一名生活在杭州的开发者。写前端与 AI
              工具，也记录技术判断、创作过程，和那些值得再看一眼的影像。
            </p>
            <div className="yuji-profile-links">
              <Link className="yuji-underlined-link" to="/about">
                ABOUT ME / 关于我 <span aria-hidden="true">→</span>
              </Link>
              <a
                className="yuji-underlined-link"
                href={YUJI_GITHUB_PROFILE_URL}
                target="_blank"
                rel="noreferrer"
              >
                GITHUB / @muddyrain <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
          <dl className="yuji-profile-index" aria-label="个人信息">
            <div>
              <dt>BASE</dt>
              <dd>HANGZHOU</dd>
            </div>
            <div>
              <dt>FOCUS</dt>
              <dd>WEB · AI · VISUAL</dd>
            </div>
            <div>
              <dt>STATUS</dt>
              <dd>BUILDING IN PUBLIC</dd>
            </div>
          </dl>
        </section>

        <section className="yuji-section yuji-home-writing" aria-labelledby="yuji-recent-title">
          <header className="yuji-section-heading" data-yuji-reveal="scroll">
            <p>LATEST SIGNALS / 08</p>
            <h2 id="yuji-recent-title">最新文章</h2>
            <Link to="/articles">全部文章 ↗</Link>
          </header>
          <div className="yuji-stage-article-grid">
            {recentPosts.map((post, index) => (
              <YujiStageArticleCard index={index} key={post.id} post={post} scope="home" />
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
            <p>VISUAL TRACE / 04</p>
            <h2 id="yuji-gallery-title">影像切片</h2>
            <Link to="/gallery">进入图库 ↗</Link>
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
          <p>ABOUT / SIGNAL OWNER</p>
          <div>
            <h2 id="yuji-home-about-title">谁在留下这些痕迹？</h2>
            <p>一个开发者的技术判断、影像练习，以及仍在发生的思考。</p>
          </div>
          <Link className="yuji-underlined-link" to="/about">
            继续了解 <span aria-hidden="true">→</span>
          </Link>
        </section>
      </div>
    </main>
  );
}
