import { create } from 'zustand';
import { ApiError } from '../api/client';
import { getUserPreference, updateUserPreference } from '../api/preferences';
import { DESKTOP_APP_LIST, type DesktopApp, type DesktopAppId } from '../apps/desktopApps';
import type { AppId } from './windowStore';

export const DOCK_PREFERENCE_NAMESPACE = 'desktop-os.dock';
const DOCK_STORAGE_KEY = 'desktop-os-dock-preference';
const DOCK_PREFERENCE_VERSION = 2;
const DOCK_SAVE_DEBOUNCE_MS = 650;
const MINI_APP_DOCK_ITEM_IDS = new Set(['calculator', 'focus', 'randomizer']);

export interface DockItemConfig {
  id: string;
  label: string;
  icon: string;
  action?: 'launchpad';
  appId?: AppId;
  visible: boolean;
  pinned: boolean;
  canOpenWindow: boolean;
  required?: boolean;
}

interface DockStore {
  items: DockItemConfig[];
  iconSize: number;
  spacing: number;
  magnification: boolean;
  autoHide: boolean;
  syncToken: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setIconSize: (value: number) => void;
  setSpacing: (value: number) => void;
  setMagnification: (value: boolean) => void;
  setAutoHide: (value: boolean) => void;
  pinItem: (id: string) => void;
  showItem: (id: string) => void;
  hideItem: (id: string) => void;
  removeItem: (id: string) => void;
  resetItems: () => void;
  loadPreferences: (token: string) => Promise<void>;
  savePreferences: (token?: string | null) => Promise<void>;
  hydrateFromPreference: (value: DockPreferenceValue) => void;
  clearServerSync: () => void;
}

export interface DockPreferenceItem {
  id: string;
  visible: boolean;
  pinned: boolean;
}

export interface DockPreferenceValue {
  version: number;
  items: DockPreferenceItem[];
  iconSize: number;
  spacing: number;
  magnification: boolean;
  autoHide: boolean;
}

const SPECIAL_DOCK_ITEMS: Record<string, DockItemConfig> = {
  launchpad: {
    id: 'launchpad',
    label: '启动台',
    icon: '/icons/launchpad.png',
    action: 'launchpad',
    visible: true,
    pinned: true,
    canOpenWindow: false,
    required: true,
  },
  mail: {
    id: 'mail',
    label: '邮件',
    icon: '/icons/mail.png',
    visible: true,
    pinned: true,
    canOpenWindow: false,
  },
  photos: {
    id: 'photos',
    label: '照片',
    icon: '/icons/photos-flower.png',
    visible: true,
    pinned: true,
    canOpenWindow: false,
  },
  'ai-tools': {
    id: 'ai-tools',
    label: 'AI 工具',
    icon: '/icons/stationery.png',
    visible: true,
    pinned: true,
    canOpenWindow: false,
  },
  appstore: {
    id: 'appstore',
    label: 'App Store',
    icon: '/icons/app-store.png',
    visible: true,
    pinned: true,
    canOpenWindow: false,
  },
  trash: {
    id: 'trash',
    label: '废纸篓',
    icon: '/icons/trash.png',
    visible: true,
    pinned: true,
    canOpenWindow: false,
  },
};

const DEFAULT_DOCK_LAYOUT = [
  'finder',
  'launchpad',
  'calendar',
  'weather',
  'safari',
  'mail',
  'notes',
  'calculator',
  'focus',
  'randomizer',
  'photos',
  'music',
  'ai-tools',
  'appstore',
  'settings',
  'account',
  'downloads',
  'plushMatch',
  'deskTidy',
  'trash',
];

const INITIAL_ITEMS = buildDefaultDockItems();

const DEFAULT_DOCK_STATE = {
  items: INITIAL_ITEMS,
  iconSize: 56,
  spacing: 6,
  magnification: true,
  autoHide: false,
};

export function buildDefaultDockItems() {
  const appItems = new Map(
    DESKTOP_APP_LIST.filter(isDockEligibleApp).map((app) => [app.id, createDockItemFromApp(app)]),
  );
  const seen = new Set<string>();
  const items: DockItemConfig[] = [];

  for (const id of DEFAULT_DOCK_LAYOUT) {
    const item = SPECIAL_DOCK_ITEMS[id] ?? appItems.get(id as DesktopAppId);
    if (!item) continue;
    seen.add(id);
    items.push({ ...item });
  }

  for (const item of appItems.values()) {
    if (!seen.has(item.id)) items.push({ ...item });
  }

  return items;
}

function isDockEligibleApp(app: DesktopApp) {
  return app.dockEligible ?? app.dockDefault;
}

function createDockItemFromApp(app: DesktopApp): DockItemConfig {
  return {
    id: app.id,
    label: app.title,
    icon: app.icon,
    appId: app.id,
    visible: app.dockDefault,
    pinned: app.dockDefault,
    canOpenWindow: true,
    required: app.dockRequired,
  };
}

let saveTimer: number | null = null;

export const useDockStore = create<DockStore>((set, get) => {
  const initialState = applyPreferenceToDockState(DEFAULT_DOCK_STATE, readLocalPreference());

  function afterChange() {
    const state = get();
    writeLocalPreference(snapshotPreference(state));
    scheduleServerSave(state.syncToken, get);
  }

  function commit(updater: Partial<DockStore> | ((state: DockStore) => Partial<DockStore>)) {
    set((state) => ({
      ...state,
      ...(typeof updater === 'function' ? updater(state) : updater),
    }));
    afterChange();
  }

  return {
    ...initialState,
    syncToken: null,
    isLoading: false,
    isSaving: false,
    error: null,

    setIconSize: (value) => commit({ iconSize: clamp(value, 44, 72), error: null }),
    setSpacing: (value) => commit({ spacing: clamp(value, 2, 16), error: null }),
    setMagnification: (value) => commit({ magnification: value, error: null }),
    setAutoHide: (value) => commit({ autoHide: value, error: null }),
    pinItem: (id) =>
      commit((state) => ({
        error: null,
        items: state.items.map((item) =>
          item.id === id ? { ...item, pinned: true, visible: true } : item,
        ),
      })),
    showItem: (id) =>
      commit((state) => ({
        error: null,
        items: state.items.map((item) =>
          item.id === id ? { ...item, pinned: true, visible: true } : item,
        ),
      })),
    hideItem: (id) =>
      commit((state) => ({
        error: null,
        items: state.items.map((item) =>
          item.id === id && !item.required ? { ...item, pinned: false, visible: false } : item,
        ),
      })),
    removeItem: (id) =>
      commit((state) => ({
        error: null,
        items: state.items.map((item) =>
          item.id === id && !item.required ? { ...item, pinned: false, visible: false } : item,
        ),
      })),
    resetItems: () => commit({ items: buildDefaultDockItems(), error: null }),

    hydrateFromPreference: (value) => {
      set((state) => ({
        ...applyPreferenceToDockState(state, value),
        error: null,
      }));
      writeLocalPreference(snapshotPreference(get()));
    },

    loadPreferences: async (token) => {
      set({ syncToken: token, isLoading: true, error: null });
      try {
        const preference = await getUserPreference(DOCK_PREFERENCE_NAMESPACE, token);
        const value = parsePreferenceValue(preference.value);
        set((state) => ({
          ...applyPreferenceToDockState(state, value),
          isLoading: false,
          error: null,
        }));
        writeLocalPreference(snapshotPreference(get()));
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          set({ isLoading: false, error: null });
          await get().savePreferences(token);
          return;
        }
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Dock 同步失败',
        });
      }
    },

    savePreferences: async (token) => {
      const nextToken = token ?? get().syncToken;
      const snapshot = snapshotPreference(get());
      writeLocalPreference(snapshot);
      if (!nextToken) return;

      set({ isSaving: true, error: null });
      try {
        await updateUserPreference(DOCK_PREFERENCE_NAMESPACE, JSON.stringify(snapshot), nextToken);
        set({ isSaving: false, error: null, syncToken: nextToken });
      } catch (error) {
        set({
          isSaving: false,
          error: error instanceof Error ? error.message : 'Dock 保存失败',
        });
      }
    },

    clearServerSync: () => {
      if (saveTimer !== null) {
        window.clearTimeout(saveTimer);
        saveTimer = null;
      }
      set({ syncToken: null, isLoading: false, isSaving: false, error: null });
    },
  };
});

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampNumber(value: number, fallback: number, min: number, max: number) {
  return clamp(Number.isFinite(value) ? value : fallback, min, max);
}

function snapshotPreference(
  state: Pick<DockStore, 'items' | 'iconSize' | 'spacing' | 'magnification' | 'autoHide'>,
): DockPreferenceValue {
  return {
    version: DOCK_PREFERENCE_VERSION,
    items: state.items.map((item) => ({
      id: item.id,
      visible: item.visible,
      pinned: item.pinned,
    })),
    iconSize: state.iconSize,
    spacing: state.spacing,
    magnification: state.magnification,
    autoHide: state.autoHide,
  };
}

function applyPreferenceToDockState(
  base: Pick<DockStore, 'items' | 'iconSize' | 'spacing' | 'magnification' | 'autoHide'>,
  value: DockPreferenceValue | null,
) {
  if (!value) return base;
  return {
    items: mergeDockItems(base.items, value.items, value.version),
    iconSize: clampNumber(value.iconSize, base.iconSize, 44, 72),
    spacing: clampNumber(value.spacing, base.spacing, 2, 16),
    magnification:
      typeof value.magnification === 'boolean' ? value.magnification : base.magnification,
    autoHide: typeof value.autoHide === 'boolean' ? value.autoHide : base.autoHide,
  };
}

export function mergeDockItems(
  defaultItems: DockItemConfig[],
  savedItems: DockPreferenceItem[] = [],
  savedVersion = DOCK_PREFERENCE_VERSION,
) {
  const defaults = new Map(defaultItems.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: DockItemConfig[] = [];

  for (const saved of savedItems) {
    const item = defaults.get(saved.id);
    if (!item) continue;
    seen.add(saved.id);
    const shouldResetMiniApp = savedVersion < 2 && MINI_APP_DOCK_ITEM_IDS.has(saved.id);
    merged.push({
      ...item,
      visible: item.required ? true : !shouldResetMiniApp && Boolean(saved.visible),
      pinned: item.required ? true : !shouldResetMiniApp && Boolean(saved.pinned),
    });
  }

  for (const item of defaultItems) {
    if (!seen.has(item.id)) merged.push(item);
  }

  return merged;
}

function readLocalPreference() {
  try {
    const raw = window.localStorage.getItem(DOCK_STORAGE_KEY);
    return raw ? parsePreferenceValue(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalPreference(value: DockPreferenceValue) {
  try {
    window.localStorage.setItem(DOCK_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function parsePreferenceValue(raw: string): DockPreferenceValue | null {
  try {
    const value = JSON.parse(raw) as Partial<DockPreferenceValue>;
    if (!Array.isArray(value.items)) return null;
    return {
      version: Number(value.version ?? DOCK_PREFERENCE_VERSION),
      items: value.items.filter(isDockPreferenceItem),
      iconSize: Number(value.iconSize),
      spacing: Number(value.spacing),
      magnification:
        typeof value.magnification === 'boolean'
          ? value.magnification
          : DEFAULT_DOCK_STATE.magnification,
      autoHide: typeof value.autoHide === 'boolean' ? value.autoHide : DEFAULT_DOCK_STATE.autoHide,
    };
  } catch {
    return null;
  }
}

function isDockPreferenceItem(value: unknown): value is DockPreferenceItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DockPreferenceItem>;
  return typeof item.id === 'string';
}

function scheduleServerSave(token: string | null, get: () => DockStore) {
  if (!token) return;
  if (saveTimer !== null) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void get().savePreferences(token);
  }, DOCK_SAVE_DEBOUNCE_MS);
}
