import { create } from 'zustand';
import {
  type BlogCategory,
  type BlogGroup,
  type BlogPost,
  type BlogPostDetail,
  type BlogPostSort,
  type BlogTag,
  getBlogPostDetail,
  listBlogCategories,
  listBlogGroups,
  listBlogPosts,
  listBlogTags,
} from '../api/blog';

const BLOG_PAGE_SIZE = 12;

interface BlogQuery {
  keyword: string;
  groupId: string | null;
  category: string | null;
  tag: string | null;
  sort: BlogPostSort;
}

interface BlogStore {
  posts: BlogPost[];
  selectedPostId: string | null;
  selectedPostDetail: BlogPostDetail | null;
  detailCache: Record<string, BlogPostDetail>;
  groups: BlogGroup[];
  categories: BlogCategory[];
  tags: BlogTag[];
  keyword: string;
  groupId: string | null;
  category: string | null;
  tag: string | null;
  sort: BlogPostSort;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  loadingMore: boolean;
  detailLoading: boolean;
  hasMore: boolean;
  error: string | null;
  detailError: string | null;
  lastLoadedAt: number | null;
  loadPosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
  selectPost: (postId: string | null) => Promise<void>;
  setKeyword: (keyword: string) => Promise<void>;
  setGroupId: (groupId: string | null) => Promise<void>;
  setCategory: (category: string | null) => Promise<void>;
  setTag: (tag: string | null) => Promise<void>;
  setSort: (sort: BlogPostSort) => Promise<void>;
}

export const useBlogStore = create<BlogStore>((set, get) => ({
  posts: [],
  selectedPostId: null,
  selectedPostDetail: null,
  detailCache: {},
  groups: [],
  categories: [],
  tags: [],
  keyword: '',
  groupId: null,
  category: null,
  tag: null,
  sort: 'newest',
  total: 0,
  page: 0,
  pageSize: BLOG_PAGE_SIZE,
  loading: false,
  loadingMore: false,
  detailLoading: false,
  hasMore: true,
  error: null,
  detailError: null,
  lastLoadedAt: null,

  loadPosts: async () => {
    if (get().loading || get().lastLoadedAt) return;
    set({ loading: true, error: null });
    try {
      const query = getBlogQuery(get());
      const [postData, groups, categories, tags] = await Promise.all([
        listBlogPosts({
          page: 1,
          pageSize: get().pageSize,
          keyword: query.keyword || undefined,
          groupId: query.groupId ?? undefined,
          category: query.category ?? undefined,
          tag: query.tag ?? undefined,
          sort: query.sort,
        }),
        listBlogGroups(),
        listBlogCategories(),
        listBlogTags(),
      ]);
      const nextSelectedId = resolveNextSelectedPostId(get().selectedPostId, postData.list);
      set({
        posts: postData.list,
        groups,
        categories,
        tags,
        selectedPostId: nextSelectedId,
        selectedPostDetail: nextSelectedId ? (get().detailCache[nextSelectedId] ?? null) : null,
        total: postData.total,
        page: postData.page ?? 1,
        hasMore: postData.list.length < postData.total,
        loading: false,
        lastLoadedAt: Date.now(),
      });
      if (nextSelectedId && !get().detailCache[nextSelectedId]) {
        await get().selectPost(nextSelectedId);
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '博客加载失败',
      });
    }
  },

  refreshPosts: async () => {
    set({ page: 0, hasMore: true, lastLoadedAt: null, posts: [], error: null });
    await get().loadPosts();
  },

  loadMorePosts: async () => {
    const state = get();
    if (state.loading || state.loadingMore || !state.hasMore) return;
    set({ loadingMore: true, error: null });
    try {
      const query = getBlogQuery(state);
      const nextPage = state.page + 1;
      const postData = await listBlogPosts({
        page: nextPage,
        pageSize: state.pageSize,
        keyword: query.keyword || undefined,
        groupId: query.groupId ?? undefined,
        category: query.category ?? undefined,
        tag: query.tag ?? undefined,
        sort: query.sort,
      });
      set((current) => {
        const nextPosts = appendUniquePosts(current.posts, postData.list);
        return {
          posts: nextPosts,
          total: postData.total,
          page: postData.page ?? nextPage,
          hasMore: nextPosts.length < postData.total,
          loadingMore: false,
          lastLoadedAt: Date.now(),
        };
      });
    } catch (error) {
      set({
        loadingMore: false,
        error: error instanceof Error ? error.message : '博客加载失败',
      });
    }
  },

  selectPost: async (postId) => {
    if (!postId) {
      set({ selectedPostId: null, selectedPostDetail: null, detailError: null });
      return;
    }
    const cached = get().detailCache[postId];
    set({
      selectedPostId: postId,
      selectedPostDetail: cached ?? null,
      detailLoading: !cached,
      detailError: null,
    });
    if (cached) return;
    try {
      const detail = await getBlogPostDetail(postId);
      set((state) => ({
        detailCache: { ...state.detailCache, [postId]: detail },
        selectedPostDetail: state.selectedPostId === postId ? detail : state.selectedPostDetail,
        detailLoading: state.selectedPostId === postId ? false : state.detailLoading,
      }));
    } catch (error) {
      set({
        detailLoading: false,
        detailError: error instanceof Error ? error.message : '博客详情加载失败',
      });
    }
  },

  setKeyword: async (keyword) => {
    set({ keyword, page: 0, hasMore: true, lastLoadedAt: null, posts: [] });
    await get().loadPosts();
  },

  setGroupId: async (groupId) => {
    set({ groupId, page: 0, hasMore: true, lastLoadedAt: null, posts: [] });
    await get().loadPosts();
  },

  setCategory: async (category) => {
    set({ category, page: 0, hasMore: true, lastLoadedAt: null, posts: [] });
    await get().loadPosts();
  },

  setTag: async (tag) => {
    set({ tag, page: 0, hasMore: true, lastLoadedAt: null, posts: [] });
    await get().loadPosts();
  },

  setSort: async (sort) => {
    set({ sort, page: 0, hasMore: true, lastLoadedAt: null, posts: [] });
    await get().loadPosts();
  },
}));

function getBlogQuery(
  state: Pick<BlogStore, 'keyword' | 'groupId' | 'category' | 'tag' | 'sort'>,
): BlogQuery {
  return {
    keyword: state.keyword.trim(),
    groupId: state.groupId,
    category: state.category,
    tag: state.tag,
    sort: state.sort,
  };
}

function resolveNextSelectedPostId(currentId: string | null, posts: BlogPost[]) {
  if (currentId && posts.some((post) => post.id === currentId)) return currentId;
  return posts[0]?.id ?? null;
}

function appendUniquePosts(current: BlogPost[], incoming: BlogPost[]) {
  const seen = new Set(current.map((post) => post.id));
  const next = [...current];
  for (const post of incoming) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    next.push(post);
  }
  return next;
}
