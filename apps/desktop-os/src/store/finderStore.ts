import { create } from 'zustand';
import type { ServerResourceSort } from '../api/resources';
import type { FinderPath } from '../finder/data';

export type FinderViewMode = 'grid' | 'list' | 'gallery';
export type FinderSelectionMode = 'replace' | 'toggle';
export type FinderSavedTypeFilter = 'all' | 'image' | 'link' | 'tool' | 'downloadable';

export interface FinderResourcePackage {
  id: string;
  name: string;
  resourceIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface FinderSavedSearch {
  id: string;
  name: string;
  keyword: string;
  tag: string | null;
  sort: ServerResourceSort;
  typeFilter: FinderSavedTypeFilter;
  createdAt: number;
}

interface FinderLocation {
  path: FinderPath;
  selectedId: string | null;
  tag: string | null;
}

interface FinderViewState {
  viewMode?: FinderViewMode;
  sort?: ServerResourceSort;
  scrollTop?: number;
  selectedId?: string | null;
}

interface FinderStoredState {
  recentResourceIds: string[];
  downloadedResourceIds: string[];
  viewStates: Record<string, FinderViewState>;
  resourcePackages: FinderResourcePackage[];
  savedSearches: FinderSavedSearch[];
}

interface FinderStore {
  currentPath: FinderPath;
  selectedId: string | null;
  selectedIds: string[];
  activeTag: string | null;
  viewMode: FinderViewMode;
  recentResourceIds: string[];
  downloadedResourceIds: string[];
  viewStates: Record<string, FinderViewState>;
  resourcePackages: FinderResourcePackage[];
  savedSearches: FinderSavedSearch[];
  history: FinderLocation[];
  future: FinderLocation[];
  setPath: (path: FinderPath, selectedId?: string | null, tag?: string | null) => void;
  selectItem: (id: string | null) => void;
  toggleSelected: (id: string, mode: FinderSelectionMode) => void;
  selectRange: (id: string, orderedIds: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: FinderViewMode) => void;
  rememberViewState: (patch: FinderViewState) => void;
  markResourceViewed: (resourceId: string) => void;
  markResourceDownloaded: (resourceId: string) => void;
  createResourcePackage: (name: string, resourceIds: string[]) => void;
  addItemsToPackage: (packageId: string, resourceIds: string[]) => void;
  removeResourcePackage: (packageId: string) => void;
  saveSearch: (input: Omit<FinderSavedSearch, 'id' | 'createdAt'>) => void;
  removeSavedSearch: (searchId: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  revealItem: (path: FinderPath, selectedId: string | null) => void;
}

const FINDER_STORAGE_KEY = 'desktop-os.finder.v1';
const MAX_ACTIVITY_ITEMS = 80;
const MAX_RESOURCE_PACKAGES = 18;
const MAX_SAVED_SEARCHES = 18;

export function getFinderViewKey(path: FinderPath, tag: string | null) {
  return `${path}:${tag ?? 'none'}`;
}

function loadStoredState(): FinderStoredState {
  if (typeof window === 'undefined') {
    return {
      recentResourceIds: [],
      downloadedResourceIds: [],
      viewStates: {},
      resourcePackages: [],
      savedSearches: [],
    };
  }
  try {
    const raw = window.localStorage.getItem(FINDER_STORAGE_KEY);
    if (!raw) {
      return {
        recentResourceIds: [],
        downloadedResourceIds: [],
        viewStates: {},
        resourcePackages: [],
        savedSearches: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<FinderStoredState>;
    return {
      recentResourceIds: Array.isArray(parsed.recentResourceIds)
        ? parsed.recentResourceIds.filter((id) => typeof id === 'string')
        : [],
      downloadedResourceIds: Array.isArray(parsed.downloadedResourceIds)
        ? parsed.downloadedResourceIds.filter((id) => typeof id === 'string')
        : [],
      viewStates:
        parsed.viewStates && typeof parsed.viewStates === 'object' ? parsed.viewStates : {},
      resourcePackages: Array.isArray(parsed.resourcePackages)
        ? parsed.resourcePackages.filter(isStoredResourcePackage)
        : [],
      savedSearches: Array.isArray(parsed.savedSearches)
        ? parsed.savedSearches.filter(isStoredSavedSearch)
        : [],
    };
  } catch {
    return {
      recentResourceIds: [],
      downloadedResourceIds: [],
      viewStates: {},
      resourcePackages: [],
      savedSearches: [],
    };
  }
}

export function createDebouncedStorageWriter(delayMs = 240) {
  let timer: number | undefined;
  let pendingState: Pick<FinderStore, keyof FinderStoredState> | null = null;

  return (state: Pick<FinderStore, keyof FinderStoredState>) => {
    if (typeof window === 'undefined') return;
    pendingState = state;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (!pendingState) return;
      window.localStorage.setItem(
        FINDER_STORAGE_KEY,
        JSON.stringify({
          recentResourceIds: pendingState.recentResourceIds,
          downloadedResourceIds: pendingState.downloadedResourceIds,
          viewStates: pendingState.viewStates,
          resourcePackages: pendingState.resourcePackages,
          savedSearches: pendingState.savedSearches,
        }),
      );
      pendingState = null;
      timer = undefined;
    }, delayMs);
  };
}

const writeStoredState = createDebouncedStorageWriter();

function saveStoredState(state: Pick<FinderStore, keyof FinderStoredState>) {
  writeStoredState(state);
}

function pushActivity(current: string[], resourceId: string) {
  return [resourceId, ...current.filter((id) => id !== resourceId)].slice(0, MAX_ACTIVITY_ITEMS);
}

function currentLocation(state: FinderStore): FinderLocation {
  return {
    path: state.currentPath,
    selectedId: state.selectedId,
    tag: state.activeTag,
  };
}

function applyLocation(location: FinderLocation) {
  return {
    currentPath: location.path,
    selectedId: location.selectedId,
    selectedIds: selectionFor(location.selectedId),
    activeTag: location.tag,
  };
}

function selectionFor(id: string | null) {
  return id ? [id] : [];
}

function uniqueResourceIds(resourceIds: string[]) {
  return Array.from(new Set(resourceIds.filter((id) => typeof id === 'string' && id.trim())));
}

function isStoredResourcePackage(value: unknown): value is FinderResourcePackage {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FinderResourcePackage>;
  return (
    typeof item.id === 'string' && typeof item.name === 'string' && Array.isArray(item.resourceIds)
  );
}

function isStoredSavedSearch(value: unknown): value is FinderSavedSearch {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FinderSavedSearch>;
  return typeof item.id === 'string' && typeof item.name === 'string';
}

export const useFinderStore = create<FinderStore>((set) => ({
  ...loadStoredState(),
  currentPath: 'all',
  selectedId: null,
  selectedIds: [],
  activeTag: null,
  viewMode: 'grid',
  history: [],
  future: [],

  setPath: (path, selectedId = null, tag = null) =>
    set((state) => {
      const next = { path, selectedId, tag };
      const current = currentLocation(state);
      if (
        current.path === next.path &&
        current.selectedId === next.selectedId &&
        current.tag === next.tag
      ) {
        return {};
      }
      return {
        ...applyLocation(next),
        history: [...state.history, current].slice(-40),
        future: [],
      };
    }),
  selectItem: (id) => set({ selectedId: id, selectedIds: selectionFor(id) }),
  toggleSelected: (id, mode) =>
    set((state) => {
      if (mode === 'replace') return { selectedId: id, selectedIds: [id] };

      const selected = new Set(state.selectedIds);
      if (selected.has(id)) {
        selected.delete(id);
      } else {
        selected.add(id);
      }
      const selectedIds = Array.from(selected);
      return {
        selectedId: selected.has(id) ? id : (selectedIds.at(-1) ?? null),
        selectedIds,
      };
    }),
  selectRange: (id, orderedIds) =>
    set((state) => {
      if (orderedIds.length === 0) return { selectedId: id, selectedIds: [id] };
      const anchorId =
        state.selectedId && orderedIds.includes(state.selectedId) ? state.selectedId : id;
      const anchorIndex = orderedIds.indexOf(anchorId);
      const targetIndex = orderedIds.indexOf(id);
      if (anchorIndex === -1 || targetIndex === -1) return { selectedId: id, selectedIds: [id] };
      const [start, end] =
        anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
      return {
        selectedId: id,
        selectedIds: orderedIds.slice(start, end + 1),
      };
    }),
  clearSelection: () => set({ selectedId: null, selectedIds: [] }),
  setViewMode: (mode) =>
    set((state) => {
      const key = getFinderViewKey(state.currentPath, state.activeTag);
      const next = {
        viewMode: mode,
        viewStates: {
          ...state.viewStates,
          [key]: { ...state.viewStates[key], viewMode: mode },
        },
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  rememberViewState: (patch) =>
    set((state) => {
      const key = getFinderViewKey(state.currentPath, state.activeTag);
      const next = {
        viewStates: {
          ...state.viewStates,
          [key]: { ...state.viewStates[key], ...patch },
        },
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  markResourceViewed: (resourceId) =>
    set((state) => {
      const next = { recentResourceIds: pushActivity(state.recentResourceIds, resourceId) };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  markResourceDownloaded: (resourceId) =>
    set((state) => {
      const next = { downloadedResourceIds: pushActivity(state.downloadedResourceIds, resourceId) };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  createResourcePackage: (name, resourceIds) =>
    set((state) => {
      const ids = uniqueResourceIds(resourceIds);
      if (ids.length === 0) return {};
      const now = Date.now();
      const next = {
        resourcePackages: [
          {
            id: `resource-package-${now}`,
            name: name.trim() || '资源包',
            resourceIds: ids,
            createdAt: now,
            updatedAt: now,
          },
          ...state.resourcePackages,
        ].slice(0, MAX_RESOURCE_PACKAGES),
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  addItemsToPackage: (packageId, resourceIds) =>
    set((state) => {
      const ids = uniqueResourceIds(resourceIds);
      if (ids.length === 0) return {};
      const next = {
        resourcePackages: state.resourcePackages.map((item) =>
          item.id === packageId
            ? {
                ...item,
                resourceIds: uniqueResourceIds([...ids, ...item.resourceIds]),
                updatedAt: Date.now(),
              }
            : item,
        ),
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  removeResourcePackage: (packageId) =>
    set((state) => {
      const next = {
        resourcePackages: state.resourcePackages.filter((item) => item.id !== packageId),
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  saveSearch: (input) =>
    set((state) => {
      const now = Date.now();
      const next = {
        savedSearches: [
          {
            ...input,
            id: `finder-search-${now}`,
            name: input.name.trim() || '保存搜索',
            keyword: input.keyword.trim(),
            createdAt: now,
          },
          ...state.savedSearches,
        ].slice(0, MAX_SAVED_SEARCHES),
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  removeSavedSearch: (searchId) =>
    set((state) => {
      const next = {
        savedSearches: state.savedSearches.filter((item) => item.id !== searchId),
      };
      saveStoredState({ ...state, ...next });
      return next;
    }),
  goBack: () =>
    set((state) => {
      const previous = state.history.at(-1);
      if (!previous) return {};
      return {
        ...applyLocation(previous),
        history: state.history.slice(0, -1),
        future: [currentLocation(state), ...state.future].slice(0, 40),
      };
    }),
  goForward: () =>
    set((state) => {
      const next = state.future[0];
      if (!next) return {};
      return {
        ...applyLocation(next),
        history: [...state.history, currentLocation(state)].slice(-40),
        future: state.future.slice(1),
      };
    }),
  goUp: () =>
    set((state) => {
      if (state.currentPath === 'all' && !state.activeTag) return {};
      return {
        currentPath: 'all',
        selectedId: null,
        selectedIds: [],
        activeTag: null,
        history: [...state.history, currentLocation(state)].slice(-40),
        future: [],
      };
    }),
  revealItem: (path, selectedId) =>
    set((state) => ({
      currentPath: path,
      selectedId,
      selectedIds: selectionFor(selectedId),
      activeTag: null,
      history: [...state.history, currentLocation(state)].slice(-40),
      future: [],
    })),
}));
