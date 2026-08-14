import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPosts, type Post } from '@/api/blog';
import { getAllResources, type Resource } from '@/api/resource';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';

type SearchType = 'all' | 'articles' | 'images';

function normalizeType(value: string | null): SearchType {
  return value === 'articles' || value === 'images' ? value : 'all';
}

function createTypeHref(query: string, type: SearchType) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (type !== 'all') params.set('type', type);
  const search = params.toString();
  return search ? `/search?${search}` : '/search';
}

export default function YujiSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const type = normalizeType(searchParams.get('type'));
  const parsedPage = Number(searchParams.get('page') || 1);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const pageSize = type === 'all' ? 6 : 12;
  const [inputValue, setInputValue] = useState(query);
  const [posts, setPosts] = useState<Post[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [postTotal, setPostTotal] = useState(0);
  const [resourceTotal, setResourceTotal] = useState(0);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [postError, setPostError] = useState(false);
  const [resourceError, setResourceError] = useState(false);

  useEffect(() => {
    setInputValue(query);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (!query) {
      setPosts([]);
      setResources([]);
      setPostTotal(0);
      setResourceTotal(0);
      setLoadingPosts(false);
      setLoadingResources(false);
      return;
    }

    const loadPosts = type === 'all' || type === 'articles';
    const loadResources = type === 'all' || type === 'images';
    setPostError(false);
    setResourceError(false);
    setLoadingPosts(loadPosts);
    setLoadingResources(loadResources);
    if (!loadPosts) {
      setPosts([]);
      setPostTotal(0);
    }
    if (!loadResources) {
      setResources([]);
      setResourceTotal(0);
    }

    const postRequest = loadPosts
      ? getPosts({ keyword: query, page, pageSize })
      : Promise.resolve(null);
    const resourceRequest = loadResources
      ? getAllResources({ keyword: query, page, pageSize })
      : Promise.resolve(null);

    Promise.allSettled([postRequest, resourceRequest]).then(([postResult, resourceResult]) => {
      if (cancelled) return;
      if (loadPosts) {
        if (postResult.status === 'fulfilled' && postResult.value) {
          setPosts(postResult.value.list ?? []);
          setPostTotal(postResult.value.total ?? 0);
        } else {
          setPosts([]);
          setPostTotal(0);
          setPostError(true);
        }
        setLoadingPosts(false);
      }
      if (loadResources) {
        if (resourceResult.status === 'fulfilled' && resourceResult.value) {
          setResources(resourceResult.value.list ?? []);
          setResourceTotal(resourceResult.value.total ?? 0);
        } else {
          setResources([]);
          setResourceTotal(0);
          setResourceError(true);
        }
        setLoadingResources(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, query, type]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = inputValue.trim();
    const next = new URLSearchParams();
    if (nextQuery) next.set('q', nextQuery);
    if (type !== 'all') next.set('type', type);
    setSearchParams(next);
  };

  const total = type === 'articles' ? postTotal : resourceTotal;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    if (nextPage <= 1) next.delete('page');
    else next.set('page', String(nextPage));
    return `/search?${next.toString()}`;
  };

  return (
    <main className="yuji-public-main yuji-search-page">
      <header className="yuji-search-hero">
        <p>SEARCH / YUJI</p>
        <h1>从文章与影像中寻找</h1>
        <form onSubmit={handleSubmit} role="search">
          <label htmlFor="yuji-search-input">搜索词</label>
          <input
            id="yuji-search-input"
            type="search"
            value={inputValue}
            maxLength={100}
            placeholder="React、TypeScript、风景……"
            onChange={(event) => setInputValue(event.currentTarget.value)}
          />
          <button type="submit">搜索</button>
        </form>
      </header>

      <nav className="yuji-search-tabs" aria-label="搜索范围">
        <Link to={createTypeHref(query, 'all')} aria-current={type === 'all' ? 'page' : undefined}>
          全部
        </Link>
        <Link
          to={createTypeHref(query, 'articles')}
          aria-current={type === 'articles' ? 'page' : undefined}
        >
          文章
        </Link>
        <Link
          to={createTypeHref(query, 'images')}
          aria-current={type === 'images' ? 'page' : undefined}
        >
          影像
        </Link>
      </nav>

      {!query ? (
        <section className="yuji-search-empty">
          <p>输入一个主题、专栏或标题，看看曾经留下过什么。</p>
          <div>
            <Link to="/articles">浏览文章 →</Link>
            <Link to="/gallery">打开图库 →</Link>
          </div>
        </section>
      ) : (
        <div className="yuji-search-results">
          {type === 'all' || type === 'articles' ? (
            <section
              className="yuji-search-section yuji-loading-surface"
              aria-labelledby="yuji-search-articles"
            >
              <BoxLoadingOverlay show={loadingPosts} title="正在搜索文章" compact />
              <header>
                <h2 id="yuji-search-articles">文章</h2>
                <span>{postTotal} 条</span>
              </header>
              {postError ? <p className="yuji-search-message">文章结果暂时无法加载。</p> : null}
              {posts.map((post, index) => (
                <article key={post.id} className="yuji-search-article">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <p>{post.group?.name || '文章'}</p>
                    <h3>
                      <Link to={`/articles/${post.id}`}>{post.title}</Link>
                    </h3>
                    <small>{post.excerpt}</small>
                  </div>
                </article>
              ))}
              {!loadingPosts && !postError && posts.length === 0 ? (
                <p className="yuji-search-message">没有找到相关文章。</p>
              ) : null}
              {type === 'all' && postTotal > posts.length ? (
                <Link className="yuji-underlined-link" to={createTypeHref(query, 'articles')}>
                  查看全部文章 →
                </Link>
              ) : null}
            </section>
          ) : null}

          {type === 'all' || type === 'images' ? (
            <section
              className="yuji-search-section yuji-loading-surface"
              aria-labelledby="yuji-search-images"
            >
              <BoxLoadingOverlay show={loadingResources} title="正在搜索影像" compact />
              <header>
                <h2 id="yuji-search-images">影像</h2>
                <span>{resourceTotal} 张</span>
              </header>
              {resourceError ? <p className="yuji-search-message">影像结果暂时无法加载。</p> : null}
              <div className="yuji-search-images">
                {resources.map((resource) => (
                  <figure key={resource.id}>
                    <Link to={`/gallery/image/${resource.id}`}>
                      <img src={resource.thumbnailUrl || resource.url} alt={resource.title} />
                    </Link>
                    <figcaption>{resource.title}</figcaption>
                  </figure>
                ))}
              </div>
              {!loadingResources && !resourceError && resources.length === 0 ? (
                <p className="yuji-search-message">没有找到相关影像。</p>
              ) : null}
              {type === 'all' && resourceTotal > resources.length ? (
                <Link className="yuji-underlined-link" to={createTypeHref(query, 'images')}>
                  查看全部影像 →
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      {query && type !== 'all' && totalPages > 1 ? (
        <nav className="yuji-search-pagination" aria-label="搜索结果分页">
          {page > 1 ? <Link to={pageHref(page - 1)}>← 上一页</Link> : <span />}
          <span>
            {page} / {totalPages}
          </span>
          {page < totalPages ? <Link to={pageHref(page + 1)}>下一页 →</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
