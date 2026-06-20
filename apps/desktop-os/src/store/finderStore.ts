import { create } from 'zustand';
import type { ServerResourceSort } from '../api/resources';
import type { FinderPath } from '../finder/data';

export type FinderViewMode = 'grid' | 'list' | 'gallery';

interface FinderLocation {
  path: FinderPath;
  selectedId: string | null;
  tagId: string | null;
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
}

interface FinderStore {
  currentPath: FinderPath;
  selectedId: string | null;
  activeTagId: string | null;
  viewMode: FinderViewMode;
  recentResourceIds: string[];
  downloadedResourceIds: string[];
  viewStates: Record<string, FinderViewState>;
  history: FinderLocation[];
  future: FinderLocation[];
  setPath: (path: FinderPath, selectedId?: string | null, tagId?: string | null) => void;
  selectItem: (id: string | null) => void;
  setViewMode: (mode: FinderViewMode) => void;
  rememberViewState: (patch: FinderViewState) => void;
  markResourceViewed: (resourceId: string) => void;
  markResourceDownloaded: (resourceId: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  revealItem: (path: FinderPath, selectedId: string | null) => void;
}

const FINDER_STORAGE_KEY = 'desktop-os.finder.v1';
const MAX_ACTIVITY_ITEMS = 80;

export function getFinderViewKey(path: FinderPath, tagId: string | null) {
  return `${path}:${tagId ?? 'none'}`;
}

function loadStoredState(): FinderStoredState {
  if (typeof window === 'undefined') {
    return { recentResourceIds: [], downloadedResourceIds: [], viewStates: {} };
  }
  try {
    const raw = window.localStorage.getItem(FINDER_STORAGE_KEY);
    if (!raw) return { recentResourceIds: [], downloadedResourceIds: [], viewStates: {} };
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
    };
  } catch {
    return { recentResourceIds: [], downloadedResourceIds: [], viewStates: {} };
  }
}

function saveStoredState(state: Pick<FinderStore, keyof FinderStoredState>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    FINDER_STORAGE_KEY,
    JSON.stringify({
      recentResourceIds: state.recentResourceIds,
      downloadedResourceIds: state.downloadedResourceIds,
      viewStates: state.viewStates,
    }),
  );
}

function pushActivity(current: string[], resourceId: string) {
  return [resourceId, ...current.filter((id) => id !== resourceId)].slice(0, MAX_ACTIVITY_ITEMS);
}

function currentLocation(state: FinderStore): FinderLocation {
  return {
    path: state.currentPath,
    selectedId: state.selectedId,
    tagId: state.activeTagId,
  };
}

function applyLocation(location: FinderLocation) {
  return {
    currentPath: location.path,
    selectedId: location.selectedId,
    activeTagId: location.tagId,
  };
}

export const useFinderStore = create<FinderStore>((set) => ({
  ...loadStoredState(),
  currentPath: 'all',
  selectedId: null,
  activeTagId: null,
  viewMode: 'grid',
  history: [],
  future: [],

  setPath: (path, selectedId = null, tagId = null) =>
    set((state) => {
      const next = { path, selectedId, tagId };
      const current = currentLocation(state);
      if (
        current.path === next.path &&
        current.selectedId === next.selectedId &&
        current.tagId === next.tagId
      ) {
        return {};
      }
      return {
        ...applyLocation(next),
        history: [...state.history, current].slice(-40),
        future: [],
      };
    }),
  selectItem: (id) => set({ selectedId: id }),
  setViewMode: (mode) =>
    set((state) => {
      const key = getFinderViewKey(state.currentPath, state.activeTagId);
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
      const key = getFinderViewKey(state.currentPath, state.activeTagId);
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
      if (state.currentPath === 'all' && !state.activeTagId) return {};
      return {
        currentPath: 'all',
        selectedId: null,
        activeTagId: null,
        history: [...state.history, currentLocation(state)].slice(-40),
        future: [],
      };
    }),
  revealItem: (path, selectedId) =>
    set((state) => ({
      currentPath: path,
      selectedId,
      activeTagId: null,
      history: [...state.history, currentLocation(state)].slice(-40),
      future: [],
    })),
}));
