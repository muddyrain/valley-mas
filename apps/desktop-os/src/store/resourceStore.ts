import { create } from 'zustand';
import {
  downloadResource,
  favoriteResource,
  listResources,
  listResourceTags,
  type ServerResource,
  type ServerResourceSort,
  type ServerResourceTag,
  unfavoriteResource,
} from '../api/resources';
import type { FinderPath } from '../finder/data';
import { useAuthStore } from './authStore';

const RESOURCE_PAGE_SIZE = 30;

interface ResourceQuery {
  keyword: string;
  tagId: string | null;
  sort: ServerResourceSort;
}

interface ResourceStore {
  resources: ServerResource[];
  tags: ServerResourceTag[];
  keyword: string;
  tagId: string | null;
  sort: ServerResourceSort;
  activeSmartView: FinderPath;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  lastLoadedAt: number | null;
  loadResources: () => Promise<void>;
  loadMoreResources: () => Promise<void>;
  refreshResources: () => Promise<void>;
  setKeyword: (keyword: string) => Promise<void>;
  setTagId: (tagId: string | null) => Promise<void>;
  setSort: (sort: ServerResourceSort) => Promise<void>;
  setActiveSmartView: (view: FinderPath) => void;
  toggleFavorite: (resourceId: string) => Promise<void>;
  download: (resourceId: string) => Promise<string | null>;
}

export const useResourceStore = create<ResourceStore>((set, get) => ({
  resources: [],
  tags: [],
  keyword: '',
  tagId: null,
  sort: 'newest',
  activeSmartView: 'all',
  total: 0,
  page: 0,
  pageSize: RESOURCE_PAGE_SIZE,
  loading: false,
  loadingMore: false,
  hasMore: true,
  error: null,
  lastLoadedAt: null,

  loadResources: async () => {
    if (get().loading || get().lastLoadedAt) return;
    set({ loading: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const query = getResourceQuery(get());
      const [resourceData, tagData] = await Promise.all([
        listResources(
          {
            includeTags: true,
            page: 1,
            pageSize: get().pageSize,
            keyword: query.keyword,
            tagId: query.tagId ?? undefined,
            sort: query.sort,
          },
          token,
        ),
        listResourceTags(),
      ]);
      set({
        resources: resourceData.list,
        tags: tagData.list,
        total: resourceData.total,
        page: resourceData.page ?? 1,
        hasMore: resourceData.list.length < resourceData.total,
        loading: false,
        lastLoadedAt: Date.now(),
      });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '资源加载失败',
      });
    }
  },

  loadMoreResources: async () => {
    const state = get();
    if (state.loading || state.loadingMore || !state.hasMore) return;

    set({ loadingMore: true, error: null });
    try {
      const token = useAuthStore.getState().token;
      const nextPage = state.page + 1;
      const query = getResourceQuery(state);
      const resourceData = await listResources(
        {
          includeTags: true,
          page: nextPage,
          pageSize: state.pageSize,
          keyword: query.keyword,
          tagId: query.tagId ?? undefined,
          sort: query.sort,
        },
        token,
      );
      set((current) => {
        const nextResources = appendUniqueResources(current.resources, resourceData.list);
        return {
          resources: nextResources,
          total: resourceData.total,
          page: resourceData.page ?? nextPage,
          hasMore: nextResources.length < resourceData.total,
          loadingMore: false,
          lastLoadedAt: Date.now(),
        };
      });
    } catch (error) {
      set({
        loadingMore: false,
        error: error instanceof Error ? error.message : '资源加载失败',
      });
    }
  },

  refreshResources: async () => {
    set({ page: 0, hasMore: true, lastLoadedAt: null, resources: [] });
    await get().loadResources();
  },

  setKeyword: async (keyword) => {
    set({ keyword, page: 0, hasMore: true, lastLoadedAt: null, resources: [] });
    await get().loadResources();
  },

  setTagId: async (tagId) => {
    set({ tagId, page: 0, hasMore: true, lastLoadedAt: null, resources: [] });
    await get().loadResources();
  },

  setSort: async (sort) => {
    set({ sort, page: 0, hasMore: true, lastLoadedAt: null, resources: [] });
    await get().loadResources();
  },

  setActiveSmartView: (view) => set({ activeSmartView: view }),

  toggleFavorite: async (resourceId) => {
    const token = useAuthStore.getState().token;
    if (!token) {
      set({ error: '请先登录' });
      return;
    }

    const current = get().resources.find((resource) => resource.id === resourceId);
    if (!current) return;

    const nextFavorited = !current.isFavorited;
    set((state) => ({
      resources: state.resources.map((resource) =>
        resource.id === resourceId ? { ...resource, isFavorited: nextFavorited } : resource,
      ),
    }));

    try {
      if (nextFavorited) {
        await favoriteResource(resourceId, token);
      } else {
        await unfavoriteResource(resourceId, token);
      }
    } catch (error) {
      set((state) => ({
        error: error instanceof Error ? error.message : '收藏操作失败',
        resources: state.resources.map((resource) =>
          resource.id === resourceId ? { ...resource, isFavorited: current.isFavorited } : resource,
        ),
      }));
    }
  },

  download: async (resourceId) => {
    try {
      const token = useAuthStore.getState().token;
      const result = await downloadResource(resourceId, token);
      return result.downloadUrl;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '下载失败' });
      return null;
    }
  },
}));

function getResourceQuery(state: Pick<ResourceStore, 'keyword' | 'tagId' | 'sort'>): ResourceQuery {
  return {
    keyword: state.keyword.trim(),
    tagId: state.tagId,
    sort: state.sort,
  };
}

function appendUniqueResources(current: ServerResource[], incoming: ServerResource[]) {
  const seen = new Set(current.map((resource) => resource.id));
  const next = [...current];
  for (const resource of incoming) {
    if (seen.has(resource.id)) continue;
    seen.add(resource.id);
    next.push(resource);
  }
  return next;
}
