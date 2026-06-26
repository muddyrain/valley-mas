import { create } from 'zustand';

export const SAFARI_HOME_URL = 'plush://start';
export const BROWSER_STORE_KEY = 'desktop-os-browser-v3';

export const MAX_TABS = 12;
export const MAX_RECENTS = 24;
export const MAX_BOOKMARKS = 64;
export const MAX_HISTORY_PERSISTED = 50;

export type BrowserStatus = 'home' | 'loading' | 'loaded' | 'embed-limited';
export type SafariSection = 'resources' | 'recents' | 'bookmarks';

export interface BrowserTab {
  id: string;
  currentUrl: string | null;
  addressInput: string;
  history: string[];
  future: string[];
  reloadKey: number;
  status: BrowserStatus;
  title: string | null;
  favicon: string | null;
  lastActivatedAt: number;
}

export interface RecentEntry {
  url: string;
  title: string | null;
  visitedAt: number;
}

export interface BookmarkEntry {
  url: string;
  title: string | null;
  addedAt: number;
}

export interface CollapsedSections {
  resources: boolean;
  recents: boolean;
  bookmarks: boolean;
}

interface BrowserStore {
  tabs: BrowserTab[];
  activeTabId: string;
  recents: RecentEntry[];
  bookmarks: BookmarkEntry[];
  collapsedSections: CollapsedSections;

  newTab: () => boolean;
  closeTab: (tabId: string) => void;
  activateTab: (tabId: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;

  openUrl: (url: string) => void;
  goHome: () => void;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  setAddressInput: (value: string) => void;
  markLoaded: (info?: { title?: string | null; favicon?: string | null }) => void;
  markEmbedLimited: () => void;
  markTabLoaded: (tabId: string, info?: { title?: string | null; favicon?: string | null }) => void;
  markTabEmbedLimited: (tabId: string) => void;

  addRecent: (url: string, title: string | null) => void;
  removeRecent: (url: string) => void;
  addBookmark: (url: string, title: string | null) => boolean;
  removeBookmark: (url: string) => void;
  toggleSection: (section: SafariSection) => void;
}

export function normalizeAddress(raw: string) {
  const value = raw.trim();
  if (!value || value === SAFARI_HOME_URL) return SAFARI_HOME_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes('.') && !value.includes(' ')) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

let tabIdSeq = 0;
function generateTabId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tab-${crypto.randomUUID()}`;
  }
  tabIdSeq += 1;
  return `tab-${Date.now().toString(36)}-${tabIdSeq}`;
}

function createHomeTab(idOverride?: string): BrowserTab {
  return {
    id: idOverride ?? generateTabId(),
    currentUrl: null,
    addressInput: SAFARI_HOME_URL,
    history: [],
    future: [],
    reloadKey: 0,
    status: 'home',
    title: null,
    favicon: null,
    lastActivatedAt: Date.now(),
  };
}

function createDefaultState(): Pick<
  BrowserStore,
  'tabs' | 'activeTabId' | 'recents' | 'bookmarks' | 'collapsedSections'
> {
  const tab = createHomeTab();
  return {
    tabs: [tab],
    activeTabId: tab.id,
    recents: [],
    bookmarks: [],
    collapsedSections: { resources: false, recents: false, bookmarks: false },
  };
}

function replaceTab(tabs: BrowserTab[], tabId: string, updater: (tab: BrowserTab) => BrowserTab) {
  return tabs.map((t) => (t.id === tabId ? updater(t) : t));
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  ...createDefaultState(),

  newTab: () => {
    const { tabs } = get();
    if (tabs.length >= MAX_TABS) return false;
    const tab = createHomeTab();
    set({ tabs: [...tabs, tab], activeTabId: tab.id });
    schedulePersist();
    return true;
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (tabs.length === 0) return;
    if (tabs.length === 1) {
      const fresh = createHomeTab();
      set({ tabs: [fresh], activeTabId: fresh.id });
      schedulePersist();
      return;
    }
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    let nextActive = activeTabId;
    if (activeTabId === tabId) {
      const neighbour = tabs[index + 1] ?? tabs[index - 1];
      nextActive = neighbour ? neighbour.id : nextTabs[0].id;
    }
    set({ tabs: nextTabs, activeTabId: nextActive });
    if (nextActive !== activeTabId) {
      set({
        tabs: replaceTab(get().tabs, nextActive, (tab) => ({
          ...tab,
          lastActivatedAt: Date.now(),
        })),
      });
    }
    schedulePersist();
  },

  activateTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (activeTabId === tabId) return;
    if (!tabs.some((t) => t.id === tabId)) return;
    set({
      activeTabId: tabId,
      tabs: replaceTab(tabs, tabId, (tab) => ({ ...tab, lastActivatedAt: Date.now() })),
    });
    schedulePersist();
  },

  reorderTabs: (fromId, toId) => {
    if (fromId === toId) return;
    const { tabs } = get();
    const fromIndex = tabs.findIndex((t) => t.id === fromId);
    const toIndex = tabs.findIndex((t) => t.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = tabs.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    set({ tabs: next });
    schedulePersist();
  },

  openUrl: (url) => {
    const next = normalizeAddress(url);
    const { tabs, activeTabId } = get();
    if (next === SAFARI_HOME_URL) {
      set({
        tabs: replaceTab(tabs, activeTabId, (tab) => ({
          ...tab,
          currentUrl: null,
          addressInput: SAFARI_HOME_URL,
          history: tab.currentUrl ? [...tab.history, tab.currentUrl] : tab.history,
          future: [],
          status: 'home',
          title: null,
          favicon: null,
        })),
      });
      schedulePersist();
      return;
    }
    set({
      tabs: replaceTab(tabs, activeTabId, (tab) => ({
        ...tab,
        currentUrl: next,
        addressInput: next,
        history: tab.currentUrl ? [...tab.history, tab.currentUrl] : tab.history,
        future: [],
        reloadKey: 0,
        status: 'loading',
        title: null,
        favicon: null,
      })),
    });
    schedulePersist();
  },

  goHome: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: replaceTab(tabs, activeTabId, (tab) => ({
        ...tab,
        currentUrl: null,
        addressInput: SAFARI_HOME_URL,
        history: tab.currentUrl ? [...tab.history, tab.currentUrl] : tab.history,
        future: [],
        status: 'home',
        title: null,
        favicon: null,
      })),
    });
    schedulePersist();
  },

  goBack: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: replaceTab(tabs, activeTabId, (tab) => {
        const previous = tab.history.at(-1);
        if (!previous) return tab;
        return {
          ...tab,
          currentUrl: previous,
          addressInput: previous,
          history: tab.history.slice(0, -1),
          future: tab.currentUrl ? [tab.currentUrl, ...tab.future] : tab.future,
          reloadKey: 0,
          status: 'loading',
          title: null,
          favicon: null,
        };
      }),
    });
    schedulePersist();
  },

  goForward: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: replaceTab(tabs, activeTabId, (tab) => {
        const next = tab.future[0];
        if (!next) return tab;
        return {
          ...tab,
          currentUrl: next,
          addressInput: next,
          history: tab.currentUrl ? [...tab.history, tab.currentUrl] : tab.history,
          future: tab.future.slice(1),
          reloadKey: 0,
          status: 'loading',
          title: null,
          favicon: null,
        };
      }),
    });
    schedulePersist();
  },

  refresh: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: replaceTab(tabs, activeTabId, (tab) => {
        if (!tab.currentUrl) return tab;
        return { ...tab, reloadKey: tab.reloadKey + 1, status: 'loading' };
      }),
    });
  },

  setAddressInput: (value) => {
    const { tabs, activeTabId } = get();
    set({ tabs: replaceTab(tabs, activeTabId, (tab) => ({ ...tab, addressInput: value })) });
  },

  markLoaded: (info) => {
    const { activeTabId } = get();
    get().markTabLoaded(activeTabId, info);
  },

  markEmbedLimited: () => {
    const { activeTabId } = get();
    get().markTabEmbedLimited(activeTabId);
  },

  markTabLoaded: (tabId, info) => {
    const { tabs } = get();
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    const title = info?.title ?? null;
    const favicon = info?.favicon ?? null;
    set({
      tabs: replaceTab(tabs, tabId, (tab) => ({
        ...tab,
        status: 'loaded',
        title: title ?? tab.title,
        favicon: favicon ?? tab.favicon,
      })),
    });
    if (target.currentUrl) {
      get().addRecent(target.currentUrl, title ?? target.title);
    }
    schedulePersist();
  },

  markTabEmbedLimited: (tabId) => {
    const { tabs } = get();
    set({
      tabs: replaceTab(tabs, tabId, (tab) => {
        if (!tab.currentUrl || tab.status !== 'loading') return tab;
        return { ...tab, status: 'embed-limited' };
      }),
    });
  },

  addRecent: (url, title) => {
    if (!url || url === SAFARI_HOME_URL) return;
    const { recents } = get();
    const filtered = recents.filter((r) => r.url !== url);
    const next = [{ url, title, visitedAt: Date.now() }, ...filtered].slice(0, MAX_RECENTS);
    set({ recents: next });
    schedulePersist();
  },

  removeRecent: (url) => {
    set({ recents: get().recents.filter((r) => r.url !== url) });
    schedulePersist();
  },

  addBookmark: (url, title) => {
    if (!url || url === SAFARI_HOME_URL) return false;
    const { bookmarks } = get();
    if (bookmarks.some((b) => b.url === url)) return false;
    if (bookmarks.length >= MAX_BOOKMARKS) return false;
    set({ bookmarks: [...bookmarks, { url, title, addedAt: Date.now() }] });
    schedulePersist();
    return true;
  },

  removeBookmark: (url) => {
    set({ bookmarks: get().bookmarks.filter((b) => b.url !== url) });
    schedulePersist();
  },

  toggleSection: (section) => {
    const { collapsedSections } = get();
    set({
      collapsedSections: { ...collapsedSections, [section]: !collapsedSections[section] },
    });
    schedulePersist();
  },
}));

interface PersistedSnapshot {
  tabs: BrowserTab[];
  activeTabId: string;
  recents: RecentEntry[];
  bookmarks: BookmarkEntry[];
  collapsedSections: CollapsedSections;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function sanitizeStatus(value: unknown, hasUrl: boolean): BrowserStatus {
  if (value === 'loading' || value === 'loaded' || value === 'embed-limited') {
    return hasUrl ? 'loading' : 'home';
  }
  return hasUrl ? 'loading' : 'home';
}

function sanitizeTab(value: unknown): BrowserTab | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!isString(raw.id)) return null;
  const currentUrl = isString(raw.currentUrl) ? raw.currentUrl : null;
  const addressInput = isString(raw.addressInput)
    ? raw.addressInput
    : (currentUrl ?? SAFARI_HOME_URL);
  const history = Array.isArray(raw.history) ? raw.history.filter(isString) : [];
  const future = Array.isArray(raw.future) ? raw.future.filter(isString) : [];
  const title = isString(raw.title) ? raw.title : null;
  const favicon = isString(raw.favicon) ? raw.favicon : null;
  return {
    id: raw.id,
    currentUrl,
    addressInput,
    history: history.slice(-MAX_HISTORY_PERSISTED),
    future: future.slice(0, MAX_HISTORY_PERSISTED),
    reloadKey: 0,
    status: sanitizeStatus(raw.status, Boolean(currentUrl)),
    title,
    favicon,
    lastActivatedAt: typeof raw.lastActivatedAt === 'number' ? raw.lastActivatedAt : 0,
  };
}

function sanitizeRecent(value: unknown): RecentEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!isString(raw.url)) return null;
  return {
    url: raw.url,
    title: isString(raw.title) ? raw.title : null,
    visitedAt: typeof raw.visitedAt === 'number' ? raw.visitedAt : Date.now(),
  };
}

function sanitizeBookmark(value: unknown): BookmarkEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!isString(raw.url)) return null;
  return {
    url: raw.url,
    title: isString(raw.title) ? raw.title : null,
    addedAt: typeof raw.addedAt === 'number' ? raw.addedAt : Date.now(),
  };
}

function sanitizeSnapshot(parsed: unknown): PersistedSnapshot | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const raw = parsed as Record<string, unknown>;
  const tabsRaw = Array.isArray(raw.tabs) ? raw.tabs : [];
  const tabs = tabsRaw.map(sanitizeTab).filter((t): t is BrowserTab => t !== null);
  if (tabs.length === 0) return null;
  const activeTabId =
    isString(raw.activeTabId) && tabs.some((t) => t.id === raw.activeTabId)
      ? raw.activeTabId
      : tabs[0].id;
  const recents = Array.isArray(raw.recents)
    ? raw.recents
        .map(sanitizeRecent)
        .filter((r): r is RecentEntry => r !== null)
        .slice(0, MAX_RECENTS)
    : [];
  const bookmarks = Array.isArray(raw.bookmarks)
    ? raw.bookmarks
        .map(sanitizeBookmark)
        .filter((b): b is BookmarkEntry => b !== null)
        .slice(0, MAX_BOOKMARKS)
    : [];
  const collapsedRaw =
    raw.collapsedSections && typeof raw.collapsedSections === 'object'
      ? (raw.collapsedSections as Record<string, unknown>)
      : {};
  const collapsedSections: CollapsedSections = {
    resources: collapsedRaw.resources === true,
    recents: collapsedRaw.recents === true,
    bookmarks: collapsedRaw.bookmarks === true,
  };
  return { tabs, activeTabId, recents, bookmarks, collapsedSections };
}

export function loadBrowserStorePersistedState() {
  if (typeof window === 'undefined') return;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(BROWSER_STORE_KEY);
  } catch {
    return;
  }
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const snapshot = sanitizeSnapshot(parsed);
  if (!snapshot) return;
  useBrowserStore.setState({
    tabs: snapshot.tabs,
    activeTabId: snapshot.activeTabId,
    recents: snapshot.recents,
    bookmarks: snapshot.bookmarks,
    collapsedSections: snapshot.collapsedSections,
  });
}

let persistTimer: ReturnType<typeof setTimeout> | undefined;

export function persistBrowserStoreSnapshot() {
  if (typeof window === 'undefined') return;
  const { tabs, activeTabId, recents, bookmarks, collapsedSections } = useBrowserStore.getState();
  const snapshot: PersistedSnapshot = {
    tabs: tabs.map((tab) => ({
      ...tab,
      history: tab.history.slice(-MAX_HISTORY_PERSISTED),
      future: tab.future.slice(0, MAX_HISTORY_PERSISTED),
    })),
    activeTabId,
    recents,
    bookmarks,
    collapsedSections,
  };
  try {
    window.localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota / privacy mode failures
  }
}

function schedulePersist() {
  if (typeof window === 'undefined') return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persistBrowserStoreSnapshot, 240);
}

export function __resetBrowserStoreForTests() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = undefined;
  }
  useBrowserStore.setState(createDefaultState());
}

if (typeof window !== 'undefined') {
  loadBrowserStorePersistedState();
}
