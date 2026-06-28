import {
  BookOpen,
  Clock3,
  Eye,
  FileUp,
  ImagePlus,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  type BlogPost,
  type BlogPostDetail,
  type BlogPostSort,
  type BlogTag,
  type BlogVisibility,
  uploadBlogCover,
} from '../api/blog';
import { useAuthStore } from '../store/authStore';
import { useBlogStore } from '../store/blogStore';
import EmptyState from '../ui/EmptyState';
import PlushImage from '../ui/PlushImage';
import PlushLoading from '../ui/PlushLoading';
import PlushLoadMore from '../ui/PlushLoadMore';
import {
  PlushBadge,
  PlushButton,
  PlushInput,
  PlushPanel,
  PlushSegmented,
  PlushTextarea,
  PlushToolbar,
} from '../ui/PlushPrimitives';
import PlushScrollbar from '../ui/PlushScrollbar';
import PlushSelect, { type PlushSelectOption } from '../ui/PlushSelect';
import './BlogWindow.css';
import './DockAppWindows.css';

const ALL = 'all';

type BlogMode = 'read' | 'write';
type ComposerView = 'split' | 'edit' | 'preview';
type ComposerFontScale = 'compact' | 'comfortable' | 'large';

const FONT_SCALE_LABEL: Record<ComposerFontScale, string> = {
  compact: '紧凑',
  comfortable: '舒适',
  large: '大字',
};

const VISIBILITY_OPTIONS: PlushSelectOption<BlogVisibility>[] = [
  { value: 'private', label: '私密' },
  { value: 'shared', label: '分享可见' },
  { value: 'public', label: '公开' },
];

interface BlogTocItem {
  id: string;
  text: string;
  level: number;
}

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
  h1({ children }) {
    return <h1 id={createHeadingId(children)}>{children}</h1>;
  },
  h2({ children }) {
    return <h2 id={createHeadingId(children)}>{children}</h2>;
  },
  h3({ children }) {
    return <h3 id={createHeadingId(children)}>{children}</h3>;
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
  const saving = useBlogStore((s) => s.saving);
  const hasMore = useBlogStore((s) => s.hasMore);
  const error = useBlogStore((s) => s.error);
  const detailError = useBlogStore((s) => s.detailError);
  const saveError = useBlogStore((s) => s.saveError);
  const loadPosts = useBlogStore((s) => s.loadPosts);
  const refreshPosts = useBlogStore((s) => s.refreshPosts);
  const loadMorePosts = useBlogStore((s) => s.loadMorePosts);
  const selectPost = useBlogStore((s) => s.selectPost);
  const createPost = useBlogStore((s) => s.createPost);
  const setKeyword = useBlogStore((s) => s.setKeyword);
  const setGroupId = useBlogStore((s) => s.setGroupId);
  const setCategory = useBlogStore((s) => s.setCategory);
  const setTag = useBlogStore((s) => s.setTag);
  const setSort = useBlogStore((s) => s.setSort);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadCurrentUser = useAuthStore((s) => s.loadCurrentUser);
  const [searchDraft, setSearchDraft] = useState(keyword);
  const [mode, setMode] = useState<BlogMode>('read');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<BlogVisibility>('private');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [composerView, setComposerView] = useState<ComposerView>('split');
  const [fontScale, setFontScale] = useState<ComposerFontScale>('comfortable');
  const [autoExcerpt, setAutoExcerpt] = useState(true);
  const [lineWrap, setLineWrap] = useState(true);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [composerNotice, setComposerNotice] = useState('');
  const [composerError, setComposerError] = useState('');
  const markdownInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (isAuthenticated && token && !user) {
      void loadCurrentUser();
    }
  }, [isAuthenticated, loadCurrentUser, token, user]);

  useEffect(() => {
    setSearchDraft(keyword);
  }, [keyword]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

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
      { value: 'newest', label: '最新发布' },
      { value: 'oldest', label: '从早到晚' },
    ],
    [],
  );

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void setKeyword(searchDraft);
  }

  function toggleComposerTag(tagId: string) {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId],
    );
  }

  async function importMarkdownFile(file: File) {
    const text = await file.text();
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const fileTitle = file.name
      .replace(/\.(md|markdown|txt)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim();
    setContent(text);
    if (!title.trim()) setTitle(heading || fileTitle);
    if (autoExcerpt && !excerpt.trim()) setExcerpt(buildExcerpt(text));
    setComposerNotice(`已导入 ${file.name}`);
    setComposerError('');
  }

  function handleMarkdownPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void importMarkdownFile(file);
    event.target.value = '';
  }

  function handleCoverPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setComposerNotice(`已选择封面 ${file.name}`);
    setComposerError('');
    event.target.value = '';
  }

  function clearCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview('');
  }

  function resetComposer() {
    setTitle('');
    setExcerpt('');
    setContent('');
    setVisibility('private');
    setSelectedTagIds([]);
    clearCover();
    setComposerNotice('');
    setComposerError('');
  }

  async function saveComposer(status: 'draft' | 'published') {
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent) {
      setComposerError('标题和正文不能为空');
      return;
    }
    if (!token) {
      setComposerError('请先登录后再保存博客');
      return;
    }

    setComposerError('');
    setComposerNotice(status === 'published' ? '正在发布博客' : '正在保存草稿');
    try {
      const uploadedCover = coverFile ? await uploadBlogCover(coverFile, token) : null;
      const post = await createPost(
        {
          title: nextTitle,
          postType: 'blog',
          visibility: status === 'published' ? 'public' : visibility,
          content: nextContent,
          excerpt: excerpt.trim() || (autoExcerpt ? buildExcerpt(nextContent) : undefined),
          cover: uploadedCover?.url,
          coverStorageKey: uploadedCover?.storageKey,
          tagIds: selectedTagIds,
          status,
          publishNow: status === 'published',
        },
        token,
      );
      if (!post) {
        setComposerError(saveError || '博客保存失败');
        return;
      }
      setComposerNotice(status === 'published' ? '博客已发布' : '草稿已保存');
      if (status === 'published') {
        setMode('read');
        resetComposer();
      }
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : '博客保存失败');
      setComposerNotice('');
    }
  }

  const selectedPost = selectedPostDetail ?? posts.find((item) => item.id === selectedPostId);
  const loadMoreStatus = loadingMore ? 'loading' : hasMore ? 'more' : 'done';
  const activeFilterCount = [keyword, groupId, category, tag].filter(Boolean).length;
  const canCreateBlog = Boolean(token && user && ['admin', 'creator'].includes(user.role));

  return (
    <section className="dock-app-window blog-window">
      <BlogHero
        mode={mode}
        onModeChange={setMode}
        total={total}
        visibleCount={posts.length}
        selectedPost={selectedPost}
        activeFilterCount={activeFilterCount}
        loading={loading}
        onRefresh={() => void refreshPosts()}
      />

      {mode === 'read' ? (
        <BlogFilters
          searchDraft={searchDraft}
          setSearchDraft={setSearchDraft}
          submitSearch={submitSearch}
          groupId={groupId}
          category={category}
          tag={tag}
          sort={sort}
          groupOptions={groupOptions}
          categoryOptions={categoryOptions}
          tagOptions={tagOptions}
          sortOptions={sortOptions}
          setGroupId={setGroupId}
          setCategory={setCategory}
          setTag={setTag}
          setSort={setSort}
        />
      ) : null}

      {error ? <div className="blog-window__error">{error}</div> : null}

      {mode === 'write' ? (
        <BlogComposer
          title={title}
          excerpt={excerpt}
          content={content}
          visibility={visibility}
          tags={tags}
          selectedTagIds={selectedTagIds}
          coverPreview={coverPreview}
          canCreateBlog={canCreateBlog}
          isAuthenticated={isAuthenticated}
          saving={saving}
          notice={composerNotice}
          error={composerError || saveError || null}
          composerView={composerView}
          fontScale={fontScale}
          autoExcerpt={autoExcerpt}
          lineWrap={lineWrap}
          markdownInputRef={markdownInputRef}
          coverInputRef={coverInputRef}
          setTitle={setTitle}
          setExcerpt={setExcerpt}
          setContent={setContent}
          setVisibility={setVisibility}
          toggleTag={toggleComposerTag}
          clearCover={clearCover}
          setComposerView={setComposerView}
          setFontScale={setFontScale}
          setAutoExcerpt={setAutoExcerpt}
          setLineWrap={setLineWrap}
          onMarkdownPick={handleMarkdownPick}
          onCoverPick={handleCoverPick}
          onSaveDraft={() => void saveComposer('draft')}
          onPublish={() => void saveComposer('published')}
        />
      ) : (
        <div
          className={`blog-window__layout ${
            isListCollapsed ? 'blog-window__layout--list-collapsed' : ''
          }`}
        >
          {isListCollapsed ? (
            <button
              type="button"
              className="blog-window__list-floating-toggle"
              aria-label="展开博客列表"
              aria-expanded={false}
              onClick={() => setIsListCollapsed(false)}
            >
              <PanelLeftOpen size={15} aria-hidden />
            </button>
          ) : null}
          <PlushScrollbar
            as="aside"
            className="blog-window__list"
            aria-label={isListCollapsed ? '博客列表已折叠' : '博客列表'}
          >
            <div className="blog-window__list-head">
              <div className="blog-window__list-title">
                <span>Reading queue</span>
                <strong>{posts.length ? `${posts.length} 篇可读` : '等待内容'}</strong>
              </div>
              <span className="blog-window__list-count">{total || posts.length}</span>
              <button
                type="button"
                className="blog-window__list-toggle"
                aria-label={isListCollapsed ? '展开博客列表' : '折叠博客列表'}
                aria-expanded={!isListCollapsed}
                onClick={() => setIsListCollapsed((value) => !value)}
              >
                {isListCollapsed ? (
                  <PanelLeftOpen size={15} aria-hidden />
                ) : (
                  <PanelLeftClose size={15} aria-hidden />
                )}
              </button>
            </div>

            <div className="blog-window__list-body">
              {loading ? (
                <PlushLoading
                  className="blog-window__empty"
                  title="正在载入博客"
                  description="正在整理阅读列表"
                  variant="panel"
                />
              ) : null}
              {!loading && posts.length === 0 ? (
                <EmptyState
                  className="blog-window__empty"
                  icon="◇"
                  title="暂无博客"
                  description="换个搜索或稍后再试"
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
            </div>
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
      )}
    </section>
  );
}

function BlogHero({
  mode,
  onModeChange,
  total,
  visibleCount,
  selectedPost,
  activeFilterCount,
  loading,
  onRefresh,
}: {
  mode: BlogMode;
  onModeChange: (mode: BlogMode) => void;
  total: number;
  visibleCount: number;
  selectedPost?: BlogPost | BlogPostDetail | null;
  activeFilterCount: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const categoryLabel = selectedPost?.group?.name || selectedPost?.category?.name || '公开博客';

  return (
    <PlushToolbar as="header" className="blog-window__hero">
      <div className="blog-window__hero-copy">
        <PlushBadge tone="primary" className="blog-window__kicker">
          <BookOpen size={14} aria-hidden />
          Public journal
        </PlushBadge>
        <h2>博客</h2>
        <p>{selectedPost?.title || '把公开发布的想法整理成一张安静、好读的桌面报纸。'}</p>
      </div>
      <section className="blog-window__hero-panel" aria-label="博客概览">
        <div className="blog-window__hero-orb" aria-hidden>
          <Sparkles size={18} />
        </div>
        <PlushSegmented
          className="blog-window__mode-switch"
          value={mode}
          options={[
            { value: 'read', label: '阅读' },
            { value: 'write', label: '创作' },
          ]}
          onValueChange={onModeChange}
          ariaLabel="博客模式"
        />
        <BlogMetric label="全部文章" value={formatCount(total || visibleCount)} />
        <BlogMetric label="当前筛选" value={`${activeFilterCount || 0}`} />
        <BlogMetric label="正在阅读" value={categoryLabel} />
        <PlushButton
          type="button"
          tone="info"
          className="blog-window__refresh"
          onClick={onRefresh}
          loading={loading}
          loadingLabel="刷新中"
        >
          <RefreshCw size={14} aria-hidden />
          <span>刷新</span>
        </PlushButton>
      </section>
    </PlushToolbar>
  );
}

function BlogMetric({ label, value }: { label: string; value: string }) {
  return (
    <PlushBadge tone="neutral" className="blog-window__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </PlushBadge>
  );
}

function BlogFilters({
  searchDraft,
  setSearchDraft,
  submitSearch,
  groupId,
  category,
  tag,
  sort,
  groupOptions,
  categoryOptions,
  tagOptions,
  sortOptions,
  setGroupId,
  setCategory,
  setTag,
  setSort,
}: {
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  submitSearch: (event: React.FormEvent<HTMLFormElement>) => void;
  groupId: string | null;
  category: string | null;
  tag: string | null;
  sort: BlogPostSort;
  groupOptions: PlushSelectOption[];
  categoryOptions: PlushSelectOption[];
  tagOptions: PlushSelectOption[];
  sortOptions: PlushSelectOption<BlogPostSort>[];
  setGroupId: (value: string | null) => Promise<void>;
  setCategory: (value: string | null) => Promise<void>;
  setTag: (value: string | null) => Promise<void>;
  setSort: (value: BlogPostSort) => Promise<void>;
}) {
  return (
    <PlushToolbar as="form" className="blog-window__toolbar" onSubmit={submitSearch}>
      <label className="blog-window__search">
        <Search size={15} aria-hidden />
        <PlushInput
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          placeholder="搜索标题、摘要或正文"
          aria-label="搜索博客"
        />
      </label>
      <div className="blog-window__filter-strip">
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
        <PlushButton type="submit" tone="info" className="blog-window__search-button">
          搜索
        </PlushButton>
      </div>
    </PlushToolbar>
  );
}

function BlogComposer({
  title,
  excerpt,
  content,
  visibility,
  tags,
  selectedTagIds,
  coverPreview,
  canCreateBlog,
  isAuthenticated,
  saving,
  notice,
  error,
  composerView,
  fontScale,
  autoExcerpt,
  lineWrap,
  markdownInputRef,
  coverInputRef,
  setTitle,
  setExcerpt,
  setContent,
  setVisibility,
  toggleTag,
  clearCover,
  setComposerView,
  setFontScale,
  setAutoExcerpt,
  setLineWrap,
  onMarkdownPick,
  onCoverPick,
  onSaveDraft,
  onPublish,
}: {
  title: string;
  excerpt: string;
  content: string;
  visibility: BlogVisibility;
  tags: BlogTag[];
  selectedTagIds: string[];
  coverPreview: string;
  canCreateBlog: boolean;
  isAuthenticated: boolean;
  saving: boolean;
  notice: string;
  error: string | null;
  composerView: ComposerView;
  fontScale: ComposerFontScale;
  autoExcerpt: boolean;
  lineWrap: boolean;
  markdownInputRef: React.RefObject<HTMLInputElement | null>;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  setTitle: (value: string) => void;
  setExcerpt: (value: string) => void;
  setContent: (value: string) => void;
  setVisibility: (value: BlogVisibility) => void;
  toggleTag: (tagId: string) => void;
  clearCover: () => void;
  setComposerView: (value: ComposerView) => void;
  setFontScale: (value: ComposerFontScale) => void;
  setAutoExcerpt: (value: boolean) => void;
  setLineWrap: (value: boolean) => void;
  onMarkdownPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCoverPick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  const wordCount = content.trim().replace(/\s+/g, '').length;
  const previewText = content || '# 新博客\n\n从这里开始写。';
  const roleMessage = isAuthenticated ? '当前账号没有创作者权限' : '请先登录后再新增博客';

  return (
    <div className="blog-composer">
      <PlushScrollbar as="aside" className="blog-composer__side" aria-label="博客创作设置">
        <PlushPanel className="blog-composer__card">
          <div className="blog-composer__card-title">
            <FileUp size={16} aria-hidden />
            <span>导入 Markdown</span>
          </div>
          <input
            ref={markdownInputRef}
            className="blog-composer__file"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={onMarkdownPick}
          />
          <PlushButton
            type="button"
            tone="neutral"
            className="blog-composer__ghost-button"
            onClick={() => markdownInputRef.current?.click()}
          >
            选择 md 文件
          </PlushButton>
        </PlushPanel>

        <PlushPanel className="blog-composer__card">
          <div className="blog-composer__card-title">
            <ImagePlus size={16} aria-hidden />
            <span>封面</span>
          </div>
          <input
            ref={coverInputRef}
            className="blog-composer__file"
            type="file"
            accept="image/*"
            onChange={onCoverPick}
          />
          <button
            type="button"
            className="blog-composer__cover"
            onClick={() => coverInputRef.current?.click()}
          >
            {coverPreview ? (
              <img src={coverPreview} alt="博客封面预览" />
            ) : (
              <span>
                <ImagePlus size={18} aria-hidden />
                选择封面
              </span>
            )}
          </button>
          {coverPreview ? (
            <PlushButton
              type="button"
              tone="danger"
              className="blog-composer__remove"
              onClick={clearCover}
            >
              <X size={13} aria-hidden />
              移除封面
            </PlushButton>
          ) : null}
        </PlushPanel>

        <PlushPanel className="blog-composer__card">
          <div className="blog-composer__card-title">
            <Sparkles size={16} aria-hidden />
            <span>标签</span>
          </div>
          <div className="blog-composer__tags">
            {tags.length ? (
              tags.map((item) => (
                <PlushButton
                  key={item.id}
                  type="button"
                  tone={selectedTagIds.includes(item.id) ? 'primary' : 'neutral'}
                  className={selectedTagIds.includes(item.id) ? 'is-active' : ''}
                  onClick={() => toggleTag(item.id)}
                >
                  {item.name}
                </PlushButton>
              ))
            ) : (
              <span className="blog-composer__hint">暂无可选标签</span>
            )}
          </div>
        </PlushPanel>

        <PlushPanel className="blog-composer__card">
          <div className="blog-composer__card-title">
            <Settings2 size={16} aria-hidden />
            <span>发布设置</span>
          </div>
          <label className="blog-composer__select-line">
            <span>可见性</span>
            <PlushSelect
              value={visibility}
              options={VISIBILITY_OPTIONS}
              onChange={setVisibility}
              ariaLabel="选择博客可见性"
            />
          </label>
          <label className="blog-composer__check-line">
            <input
              type="checkbox"
              checked={autoExcerpt}
              onChange={(event) => setAutoExcerpt(event.target.checked)}
            />
            自动生成摘要
          </label>
          <label className="blog-composer__check-line">
            <input
              type="checkbox"
              checked={lineWrap}
              onChange={(event) => setLineWrap(event.target.checked)}
            />
            编辑器自动换行
          </label>
        </PlushPanel>
      </PlushScrollbar>

      <main className="blog-composer__workspace">
        <section className="blog-composer__topline">
          <div>
            <span>Writer studio</span>
            <strong>{wordCount ? `${wordCount} 字` : '准备写作'}</strong>
          </div>
          <div className="blog-composer__actions">
            <PlushButton
              type="button"
              tone="neutral"
              onClick={onSaveDraft}
              disabled={!canCreateBlog || saving}
            >
              <Save size={14} aria-hidden />
              存草稿
            </PlushButton>
            <PlushButton
              type="button"
              tone="info"
              onClick={onPublish}
              disabled={!canCreateBlog || saving}
            >
              <Send size={14} aria-hidden />
              发布
            </PlushButton>
          </div>
        </section>

        {!canCreateBlog ? <div className="blog-window__error">{roleMessage}</div> : null}
        {error ? <div className="blog-window__error">{error}</div> : null}
        {notice ? (
          <div className="blog-composer__notice">{saving ? `${notice}...` : notice}</div>
        ) : null}

        <section className="blog-composer__paper">
          <PlushInput
            className="blog-composer__title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="博客标题"
          />
          <PlushTextarea
            className="blog-composer__excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="摘要会显示在列表和文章顶部"
            rows={2}
          />

          <div className="blog-composer__config">
            <PlushSegmented
              className="blog-composer__segmented"
              value={composerView}
              options={[
                { value: 'split', label: '分屏' },
                { value: 'edit', label: '编辑' },
                { value: 'preview', label: '预览' },
              ]}
              onValueChange={setComposerView}
              ariaLabel="编辑器视图"
            />
            <div className="blog-composer__font-pick">
              <Type size={14} aria-hidden />
              <PlushSegmented
                value={fontScale}
                options={[
                  { value: 'compact', label: FONT_SCALE_LABEL.compact },
                  { value: 'comfortable', label: FONT_SCALE_LABEL.comfortable },
                  { value: 'large', label: FONT_SCALE_LABEL.large },
                ]}
                onValueChange={setFontScale}
                ariaLabel="编辑器字号"
              />
            </div>
          </div>

          <div
            className={`blog-composer__editor blog-composer__editor--${composerView} blog-composer__editor--${fontScale} ${
              lineWrap ? 'is-wrapped' : ''
            }`}
          >
            {composerView !== 'preview' ? (
              <PlushTextarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="支持 Markdown 和 GFM 表格、任务列表、链接、代码块"
                spellCheck={false}
              />
            ) : null}
            {composerView !== 'edit' ? (
              <PlushScrollbar
                as="section"
                className="blog-composer__preview"
                contentClassName="blog-composer__preview-content"
                aria-label="博客预览"
              >
                <BlogMarkdown content={previewText} />
              </PlushScrollbar>
            ) : null}
          </div>
        </section>
      </main>
    </div>
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
  const publishedAt = post.publishedAt || post.createdAt;
  const categoryLabel = post.group?.name || post.category?.name || '博客';

  return (
    <button
      type="button"
      className={`blog-post-row ${active ? 'is-active' : ''}`}
      onClick={onSelect}
    >
      <span className="blog-post-row__text">
        <span className="blog-post-row__meta">
          <span>{categoryLabel}</span>
          <time>{formatBlogDate(publishedAt)}</time>
        </span>
        <strong>{post.title}</strong>
        <p>{post.excerpt || '暂无摘要'}</p>
        <span className="blog-post-row__stats">
          <span>
            <Eye size={12} aria-hidden />
            {formatCount(post.viewCount || 0)}
          </span>
          <span>
            <Clock3 size={12} aria-hidden />
            {getReadingMinutes(post.excerpt || post.title)} 分钟
          </span>
        </span>
      </span>
    </button>
  );
}

function BlogReader({ post }: { post: BlogPostDetail | null }) {
  if (!post) {
    return (
      <EmptyState
        className="blog-window__empty blog-reader__placeholder"
        icon="◇"
        title="选择一篇博客"
        description="文章内容会显示在这里"
      />
    );
  }

  const publishedAt = post.publishedAt || post.createdAt;
  const readingMinutes = getReadingMinutes(post.content || post.excerpt || '');
  const categoryLabel = post.group?.name || post.category?.name || '公开文章';
  const tags = post.tags ?? [];
  const toc = getBlogToc(post.content || '');

  function scrollToHeading(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <article className="blog-reader">
      <div className="blog-reader__shell">
        <main className="blog-reader__main">
          <div className="blog-reader__paper">
            <section className="blog-reader__masthead">
              <div className="blog-reader__meta">
                <span>{categoryLabel}</span>
                <time>{formatBlogDate(publishedAt)}</time>
                <span>{post.author?.nickname || '创作者'}</span>
              </div>
              <h3>{post.title}</h3>
              {post.excerpt ? <p className="blog-reader__excerpt">{post.excerpt}</p> : null}
              <section className="blog-reader__quick-stats" aria-label="文章信息">
                <span>
                  <Clock3 size={13} aria-hidden />
                  {readingMinutes} 分钟
                </span>
                <span>
                  <Eye size={13} aria-hidden />
                  {formatCount(post.viewCount || 0)} 次浏览
                </span>
              </section>
              {tags.length ? (
                <div className="blog-reader__tags blog-reader__tags--inline">
                  {tags.map((item) => (
                    <PlushBadge key={item.id} tone="primary">
                      {item.name}
                    </PlushBadge>
                  ))}
                </div>
              ) : null}
              <div className="blog-reader__cover-frame">
                <PlushImage
                  className="blog-reader__cover"
                  src={post.cover}
                  alt={post.title}
                  fit="contain"
                  fallbackTitle="无封面"
                  showRetry={false}
                  loading="eager"
                />
              </div>
            </section>

            <BlogMarkdown content={post.content || ''} />
          </div>
        </main>

        <aside className="blog-reader__aside blog-reader__outline" aria-label="文章大纲">
          <section className="blog-reader__outline-panel">
            <div className="blog-reader__side-title">
              <List size={14} aria-hidden />
              <strong>大纲</strong>
              <PlushBadge tone="info">{readingMinutes} 分钟</PlushBadge>
            </div>
            {toc.length ? (
              <nav className="blog-reader__toc">
                {toc.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    style={
                      {
                        '--toc-indent': `${Math.max(0, item.level - 1) * 10}px`,
                      } as React.CSSProperties
                    }
                    onClick={() => scrollToHeading(item.id)}
                  >
                    {item.text}
                  </button>
                ))}
              </nav>
            ) : (
              <p className="blog-reader__outline-empty">暂无目录</p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}

function nodeToPlainText(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeToPlainText).join('');
  if (typeof node === 'object' && 'props' in node) {
    return nodeToPlainText((node as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return '';
}

function slugHeading(text: string) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'section';
}

function createHeadingId(children: React.ReactNode) {
  return slugHeading(nodeToPlainText(children));
}

function getBlogToc(markdown: string): BlogTocItem[] {
  return markdown
    .split('\n')
    .map((line) => line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const text = match[2]
        .replace(/!\[([^\]]*)]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
        .replace(/[`*_~]/g, '')
        .trim();
      return {
        id: slugHeading(text),
        text,
        level: match[1].length,
      };
    })
    .filter((item) => item.text)
    .slice(0, 8);
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

function formatCount(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return String(value);
}

function buildExcerpt(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, (match) => match.replace(/^\[|\]\([^)]*\)$/g, ''))
    .replace(/[#>*_`~\-[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

function getReadingMinutes(content: string) {
  const words = content.trim().replace(/\s+/g, '');
  return Math.max(1, Math.ceil(words.length / 500));
}
