import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { BlogPost, BlogPostDetail, BlogPostSort } from '../api/blog';
import { useBlogStore } from '../store/blogStore';
import EmptyState from '../ui/EmptyState';
import PlushImage from '../ui/PlushImage';
import PlushLoading from '../ui/PlushLoading';
import PlushLoadMore from '../ui/PlushLoadMore';
import { PlushButton } from '../ui/PlushPrimitives';
import PlushScrollbar from '../ui/PlushScrollbar';
import PlushSelect, { type PlushSelectOption } from '../ui/PlushSelect';
import './BlogWindow.css';
import './DockAppWindows.css';

const ALL = 'all';

const blogMarkdownComponents: Components = {
  a({ children, href }) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  img({ alt, src }) {
    return (
      <PlushImage
        className="blog-reader__markdown-image"
        src={src}
        alt={alt}
        fit="contain"
        fallbackTitle="图片暂不可见"
        showRetry={false}
      />
    );
  },
};

export default function BlogWindow() {
  const posts = useBlogStore((s) => s.posts);
  const selectedPostId = useBlogStore((s) => s.selectedPostId);
  const selectedPostDetail = useBlogStore((s) => s.selectedPostDetail);
  const groups = useBlogStore((s) => s.groups);
  const categories = useBlogStore((s) => s.categories);
  const tags = useBlogStore((s) => s.tags);
  const keyword = useBlogStore((s) => s.keyword);
  const groupId = useBlogStore((s) => s.groupId);
  const category = useBlogStore((s) => s.category);
  const tag = useBlogStore((s) => s.tag);
  const sort = useBlogStore((s) => s.sort);
  const total = useBlogStore((s) => s.total);
  const loading = useBlogStore((s) => s.loading);
  const loadingMore = useBlogStore((s) => s.loadingMore);
  const detailLoading = useBlogStore((s) => s.detailLoading);
  const hasMore = useBlogStore((s) => s.hasMore);
  const error = useBlogStore((s) => s.error);
  const detailError = useBlogStore((s) => s.detailError);
  const loadPosts = useBlogStore((s) => s.loadPosts);
  const refreshPosts = useBlogStore((s) => s.refreshPosts);
  const loadMorePosts = useBlogStore((s) => s.loadMorePosts);
  const selectPost = useBlogStore((s) => s.selectPost);
  const setKeyword = useBlogStore((s) => s.setKeyword);
  const setGroupId = useBlogStore((s) => s.setGroupId);
  const setCategory = useBlogStore((s) => s.setCategory);
  const setTag = useBlogStore((s) => s.setTag);
  const setSort = useBlogStore((s) => s.setSort);
  const [searchDraft, setSearchDraft] = useState(keyword);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  const groupOptions = useMemo<PlushSelectOption[]>(
    () => [
      { value: ALL, label: '全部分组' },
      ...groups.map((item) => ({ value: item.id, label: item.name })),
    ],
    [groups],
  );
  const categoryOptions = useMemo<PlushSelectOption[]>(
    () => [
      { value: ALL, label: '全部分类' },
      ...categories.map((item) => ({ value: item.slug, label: item.name })),
    ],
    [categories],
  );
  const tagOptions = useMemo<PlushSelectOption[]>(
    () => [
      { value: ALL, label: '全部标签' },
      ...tags.map((item) => ({ value: item.slug, label: item.name })),
    ],
    [tags],
  );
  const sortOptions = useMemo<PlushSelectOption<BlogPostSort>[]>(
    () => [
      { value: 'newest', label: '最新' },
      { value: 'oldest', label: '最早' },
    ],
    [],
  );

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void setKeyword(searchDraft);
  }

  const loadMoreStatus = loadingMore ? 'loading' : hasMore ? 'more' : 'done';

  return (
    <section className="dock-app-window blog-window">
      <header className="blog-window__header">
        <div>
          <div className="dock-app-window__eyebrow">公开博客</div>
          <h2>博客</h2>
          <p>{total > 0 ? `${total} 篇文章` : '阅读已发布文章'}</p>
        </div>
        <PlushButton
          type="button"
          unstyled
          className="dock-app-window__button"
          onClick={() => void refreshPosts()}
          loading={loading}
          loadingLabel="刷新中"
        >
          刷新
        </PlushButton>
      </header>

      <form className="blog-window__toolbar" onSubmit={submitSearch}>
        <label className="blog-window__search">
          <Search size={15} aria-hidden />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="搜索博客"
            aria-label="搜索博客"
          />
        </label>
        <PlushSelect
          value={groupId ?? ALL}
          options={groupOptions}
          onChange={(value) => void setGroupId(value === ALL ? null : value)}
          ariaLabel="选择博客分组"
        />
        <PlushSelect
          value={category ?? ALL}
          options={categoryOptions}
          onChange={(value) => void setCategory(value === ALL ? null : value)}
          ariaLabel="选择博客分类"
        />
        <PlushSelect
          value={tag ?? ALL}
          options={tagOptions}
          onChange={(value) => void setTag(value === ALL ? null : value)}
          ariaLabel="选择博客标签"
        />
        <PlushSelect
          value={sort}
          options={sortOptions}
          onChange={(value) => void setSort(value)}
          ariaLabel="排序"
        />
        <button type="submit" className="dock-app-window__button">
          搜索
        </button>
      </form>

      {error ? <div className="blog-window__error">{error}</div> : null}

      <div className="blog-window__layout">
        <PlushScrollbar as="aside" className="blog-window__list" aria-label="博客列表">
          {loading ? (
            <PlushLoading
              className="blog-window__empty"
              title="正在载入博客"
              description="请稍候"
              variant="panel"
            />
          ) : null}
          {!loading && posts.length === 0 ? (
            <EmptyState
              className="blog-window__empty"
              icon="◇"
              title="暂无博客"
              description="稍后再试"
            />
          ) : null}
          {posts.map((post) => (
            <BlogPostRow
              key={post.id}
              post={post}
              active={post.id === selectedPostId}
              onSelect={() => void selectPost(post.id)}
            />
          ))}
          {posts.length > 0 ? (
            <PlushLoadMore
              status={loadMoreStatus}
              onLoadMore={() => void loadMorePosts()}
              moreLabel="继续载入"
              loadingLabel="正在载入更多"
              doneLabel="已显示全部"
            />
          ) : null}
        </PlushScrollbar>

        <PlushScrollbar
          as="main"
          className="blog-window__reader"
          contentClassName="blog-window__reader-content"
          aria-label="博客正文"
        >
          {detailLoading ? (
            <div className="blog-window__reader-loading">
              <PlushLoading title="正在打开文章" description="请稍候" variant="panel" />
            </div>
          ) : null}
          {detailError ? <div className="blog-window__error">{detailError}</div> : null}
          {!detailLoading && !detailError ? <BlogReader post={selectedPostDetail} /> : null}
        </PlushScrollbar>
      </div>
    </section>
  );
}

function BlogPostRow({
  post,
  active,
  onSelect,
}: {
  post: BlogPost;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`blog-post-row ${active ? 'is-active' : ''}`}
      onClick={onSelect}
    >
      <PlushImage
        className="blog-post-row__cover"
        src={post.cover}
        alt={post.title}
        fit="cover"
        fallbackTitle="无封面"
        showRetry={false}
      />
      <span className="blog-post-row__text">
        <span className="blog-post-row__meta">
          <span>{post.group?.name || post.category?.name || '博客'}</span>
          <time>{formatBlogDate(post.publishedAt || post.createdAt)}</time>
        </span>
        <strong>{post.title}</strong>
        <p>{post.excerpt || '暂无摘要'}</p>
      </span>
    </button>
  );
}

function BlogReader({ post }: { post: BlogPostDetail | null }) {
  if (!post) {
    return (
      <EmptyState
        className="blog-window__empty"
        icon="◇"
        title="选择一篇博客"
        description="文章内容会显示在这里"
      />
    );
  }

  const publishedAt = post.publishedAt || post.createdAt;
  const readingMinutes = getReadingMinutes(post.content || post.excerpt || '');

  return (
    <article className="blog-reader">
      <PlushImage
        className="blog-reader__cover"
        src={post.cover}
        alt={post.title}
        fit="cover"
        fallbackTitle="无封面"
        showRetry={false}
        loading="eager"
      />
      <header className="blog-reader__head">
        <div className="blog-reader__meta">
          <span>{post.author?.nickname || '创作者'}</span>
          <time>{formatBlogDate(publishedAt)}</time>
          <span>{readingMinutes} 分钟</span>
          <span>{post.viewCount || 0} 次浏览</span>
        </div>
        <h3>{post.title}</h3>
        {post.excerpt ? <p className="blog-reader__excerpt">{post.excerpt}</p> : null}
        {post.tags?.length ? (
          <div className="blog-reader__tags">
            {post.tags.map((item) => (
              <span key={item.id}>{item.name}</span>
            ))}
          </div>
        ) : null}
      </header>
      <BlogMarkdown content={post.content || ''} />
    </article>
  );
}

function BlogMarkdown({ content }: { content: string }) {
  const markdown = content.trim();

  if (!markdown) {
    return <p className="blog-reader__fallback">暂无正文</p>;
  }

  return (
    <ReactMarkdown
      className="blog-reader__body"
      remarkPlugins={[remarkGfm]}
      components={blogMarkdownComponents}
    >
      {markdown}
    </ReactMarkdown>
  );
}

function formatBlogDate(value?: string) {
  if (!value) return '未发布';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function getReadingMinutes(content: string) {
  const words = content.trim().replace(/\s+/g, '');
  return Math.max(1, Math.ceil(words.length / 500));
}
