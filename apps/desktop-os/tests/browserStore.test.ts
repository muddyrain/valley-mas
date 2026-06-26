import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetBrowserStoreForTests,
  BROWSER_STORE_KEY,
  loadBrowserStorePersistedState,
  persistBrowserStoreSnapshot,
  SAFARI_HOME_URL,
  useBrowserStore,
} from '../src/store/browserStore';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => (map.has(key) ? (map.get(key) ?? null) : null)),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
    clear: vi.fn(() => {
      map.clear();
    }),
    key: vi.fn((index: number) => Array.from(map.keys())[index] ?? null),
    get length() {
      return map.size;
    },
  } satisfies Storage;
}

describe('browser store · default state', () => {
  beforeEach(() => {
    __resetBrowserStoreForTests();
  });

  it('starts with a single home tab and matching activeTabId', () => {
    const state = useBrowserStore.getState();

    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0]).toMatchObject({
      currentUrl: null,
      addressInput: SAFARI_HOME_URL,
      history: [],
      future: [],
      reloadKey: 0,
      status: 'home',
      title: null,
      favicon: null,
    });
    expect(state.activeTabId).toBe(state.tabs[0].id);
  });

  it('starts with empty recents, bookmarks and all sections expanded', () => {
    const state = useBrowserStore.getState();

    expect(state.recents).toEqual([]);
    expect(state.bookmarks).toEqual([]);
    expect(state.collapsedSections).toEqual({
      resources: false,
      recents: false,
      bookmarks: false,
    });
  });
});

describe('browser store · tab CRUD', () => {
  beforeEach(() => {
    __resetBrowserStoreForTests();
  });

  it('appends a new home tab and activates it on newTab()', () => {
    const before = useBrowserStore.getState().tabs[0].id;

    useBrowserStore.getState().newTab();

    const next = useBrowserStore.getState();
    expect(next.tabs).toHaveLength(2);
    expect(next.tabs[0].id).toBe(before);
    expect(next.tabs[1].currentUrl).toBeNull();
    expect(next.activeTabId).toBe(next.tabs[1].id);
  });

  it('rejects new tabs once 12 tabs exist', () => {
    for (let i = 0; i < 11; i += 1) {
      useBrowserStore.getState().newTab();
    }
    expect(useBrowserStore.getState().tabs).toHaveLength(12);

    const result = useBrowserStore.getState().newTab();

    expect(result).toBe(false);
    expect(useBrowserStore.getState().tabs).toHaveLength(12);
  });

  it('closes the active tab and activates the right neighbour', () => {
    useBrowserStore.getState().newTab();
    useBrowserStore.getState().newTab();
    const tabs = useBrowserStore.getState().tabs;
    const middleId = tabs[1].id;
    const rightId = tabs[2].id;
    useBrowserStore.getState().activateTab(middleId);

    useBrowserStore.getState().closeTab(middleId);

    const next = useBrowserStore.getState();
    expect(next.tabs.map((t) => t.id)).not.toContain(middleId);
    expect(next.activeTabId).toBe(rightId);
  });

  it('replaces the only tab with a fresh home tab when closed', () => {
    const onlyId = useBrowserStore.getState().tabs[0].id;

    useBrowserStore.getState().closeTab(onlyId);

    const next = useBrowserStore.getState();
    expect(next.tabs).toHaveLength(1);
    expect(next.tabs[0].id).not.toBe(onlyId);
    expect(next.tabs[0].currentUrl).toBeNull();
    expect(next.activeTabId).toBe(next.tabs[0].id);
  });

  it('reorderTabs moves a tab without changing the active tab', () => {
    useBrowserStore.getState().newTab();
    useBrowserStore.getState().newTab();
    const [a, b, c] = useBrowserStore.getState().tabs.map((t) => t.id);
    useBrowserStore.getState().activateTab(b);

    useBrowserStore.getState().reorderTabs(a, c);

    const next = useBrowserStore.getState();
    expect(next.tabs.map((t) => t.id)).toEqual([b, c, a]);
    expect(next.activeTabId).toBe(b);
  });
});

describe('browser store · navigation', () => {
  beforeEach(() => {
    __resetBrowserStoreForTests();
  });

  it('openUrl normalises bare hostnames and sets loading status on the active tab', () => {
    useBrowserStore.getState().openUrl('example.com');

    const tab = useBrowserStore.getState().tabs[0];
    expect(tab.currentUrl).toBe('https://example.com');
    expect(tab.addressInput).toBe('https://example.com');
    expect(tab.status).toBe('loading');
    expect(tab.history).toEqual([]);
    expect(tab.future).toEqual([]);
  });

  it('pushes the previous url onto history when navigating to another url', () => {
    useBrowserStore.getState().openUrl('example.com');
    useBrowserStore.getState().openUrl('https://valley.dev');

    const tab = useBrowserStore.getState().tabs[0];
    expect(tab.currentUrl).toBe('https://valley.dev');
    expect(tab.history).toEqual(['https://example.com']);
  });

  it('goBack / goForward only mutate the active tab', () => {
    useBrowserStore.getState().newTab();
    const [firstId, secondId] = useBrowserStore.getState().tabs.map((t) => t.id);

    useBrowserStore.getState().activateTab(firstId);
    useBrowserStore.getState().openUrl('https://a.test');
    useBrowserStore.getState().openUrl('https://b.test');

    useBrowserStore.getState().activateTab(secondId);
    useBrowserStore.getState().openUrl('https://other.test');

    useBrowserStore.getState().activateTab(firstId);
    useBrowserStore.getState().goBack();

    const tabs = useBrowserStore.getState().tabs;
    const first = tabs.find((t) => t.id === firstId);
    const second = tabs.find((t) => t.id === secondId);
    expect(first?.currentUrl).toBe('https://a.test');
    expect(first?.future).toEqual(['https://b.test']);
    expect(second?.currentUrl).toBe('https://other.test');
  });

  it('refresh increments reloadKey and resets status to loading on the active tab', () => {
    useBrowserStore.getState().openUrl('example.com');
    const before = useBrowserStore.getState().tabs[0].reloadKey;

    useBrowserStore.getState().markLoaded({ title: 'Example' });
    useBrowserStore.getState().refresh();

    const tab = useBrowserStore.getState().tabs[0];
    expect(tab.reloadKey).toBe(before + 1);
    expect(tab.status).toBe('loading');
  });
});

describe('browser store · markLoaded and recents', () => {
  beforeEach(() => {
    __resetBrowserStoreForTests();
  });

  it('writes the title onto the active tab and prepends a recent entry', () => {
    useBrowserStore.getState().openUrl('https://valley.dev');

    useBrowserStore.getState().markLoaded({ title: 'Valley' });

    const state = useBrowserStore.getState();
    expect(state.tabs[0].title).toBe('Valley');
    expect(state.tabs[0].status).toBe('loaded');
    expect(state.recents[0]).toMatchObject({
      url: 'https://valley.dev',
      title: 'Valley',
    });
  });

  it('does not record the home URL in recents', () => {
    useBrowserStore.getState().goHome();
    useBrowserStore.getState().markLoaded({ title: 'home' });

    expect(useBrowserStore.getState().recents).toEqual([]);
  });

  it('moves an existing recent entry back to the top on revisit', () => {
    const { addRecent } = useBrowserStore.getState();
    addRecent('https://a.test', 'A');
    addRecent('https://b.test', 'B');
    addRecent('https://a.test', 'A revisited');

    const recents = useBrowserStore.getState().recents;
    expect(recents.map((r) => r.url)).toEqual(['https://a.test', 'https://b.test']);
    expect(recents[0].title).toBe('A revisited');
  });

  it('truncates recents to the last 24 entries (LRU)', () => {
    const { addRecent } = useBrowserStore.getState();
    for (let i = 0; i < 30; i += 1) {
      addRecent(`https://example.com/${i}`, `entry ${i}`);
    }

    const recents = useBrowserStore.getState().recents;
    expect(recents).toHaveLength(24);
    expect(recents[0].url).toBe('https://example.com/29');
    expect(recents[recents.length - 1].url).toBe('https://example.com/6');
  });

  it('removeRecent drops a single entry without affecting the rest', () => {
    const { addRecent, removeRecent } = useBrowserStore.getState();
    addRecent('https://a.test', 'A');
    addRecent('https://b.test', 'B');

    removeRecent('https://a.test');

    expect(useBrowserStore.getState().recents.map((r) => r.url)).toEqual(['https://b.test']);
  });
});

describe('browser store · bookmarks', () => {
  beforeEach(() => {
    __resetBrowserStoreForTests();
  });

  it('addBookmark deduplicates by url and keeps the original entry', () => {
    const { addBookmark } = useBrowserStore.getState();

    expect(addBookmark('https://valley.dev', 'Valley')).toBe(true);
    expect(addBookmark('https://valley.dev', 'Valley v2')).toBe(false);

    const bookmarks = useBrowserStore.getState().bookmarks;
    expect(bookmarks).toHaveLength(1);
    expect(bookmarks[0].title).toBe('Valley');
  });

  it('addBookmark rejects new entries once the 64 cap is reached', () => {
    const { addBookmark } = useBrowserStore.getState();
    for (let i = 0; i < 64; i += 1) {
      expect(addBookmark(`https://example.com/${i}`, null)).toBe(true);
    }

    expect(addBookmark('https://example.com/full', null)).toBe(false);
    expect(useBrowserStore.getState().bookmarks).toHaveLength(64);
  });

  it('removeBookmark drops the matching entry', () => {
    const { addBookmark, removeBookmark } = useBrowserStore.getState();
    addBookmark('https://a.test', 'A');
    addBookmark('https://b.test', 'B');

    removeBookmark('https://a.test');

    expect(useBrowserStore.getState().bookmarks.map((b) => b.url)).toEqual(['https://b.test']);
  });
});

describe('browser store · sections', () => {
  beforeEach(() => {
    __resetBrowserStoreForTests();
  });

  it('toggleSection flips the collapsed flag for the targeted section', () => {
    useBrowserStore.getState().toggleSection('recents');

    expect(useBrowserStore.getState().collapsedSections).toEqual({
      resources: false,
      recents: true,
      bookmarks: false,
    });

    useBrowserStore.getState().toggleSection('recents');

    expect(useBrowserStore.getState().collapsedSections.recents).toBe(false);
  });
});

describe('browser store · persistence', () => {
  let storage: ReturnType<typeof createMemoryStorage>;

  beforeEach(() => {
    storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage });
    __resetBrowserStoreForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores tabs, recents, bookmarks and collapsed sections from localStorage', () => {
    const snapshot = {
      tabs: [
        {
          id: 'tab-home',
          currentUrl: null,
          addressInput: SAFARI_HOME_URL,
          history: [],
          future: [],
          reloadKey: 7,
          status: 'loaded',
          title: null,
          favicon: null,
        },
        {
          id: 'tab-page',
          currentUrl: 'https://valley.dev',
          addressInput: 'https://valley.dev',
          history: ['https://example.com'],
          future: [],
          reloadKey: 3,
          status: 'embed-limited',
          title: 'Valley',
          favicon: null,
        },
      ],
      activeTabId: 'tab-page',
      recents: [{ url: 'https://valley.dev', title: 'Valley', visitedAt: 1 }],
      bookmarks: [{ url: 'https://valley.dev', title: 'Valley', addedAt: 1 }],
      collapsedSections: { resources: false, recents: true, bookmarks: false },
    };
    storage.setItem(BROWSER_STORE_KEY, JSON.stringify(snapshot));

    loadBrowserStorePersistedState();

    const state = useBrowserStore.getState();
    expect(state.tabs.map((t) => t.id)).toEqual(['tab-home', 'tab-page']);
    expect(state.activeTabId).toBe('tab-page');
    expect(state.recents).toEqual(snapshot.recents);
    expect(state.bookmarks).toEqual(snapshot.bookmarks);
    expect(state.collapsedSections).toEqual(snapshot.collapsedSections);
  });

  it('resets reloadKey to 0 and status to loading/home on hydrate', () => {
    storage.setItem(
      BROWSER_STORE_KEY,
      JSON.stringify({
        tabs: [
          {
            id: 'home',
            currentUrl: null,
            addressInput: SAFARI_HOME_URL,
            history: [],
            future: [],
            reloadKey: 5,
            status: 'loaded',
            title: null,
            favicon: null,
          },
          {
            id: 'page',
            currentUrl: 'https://valley.dev',
            addressInput: 'https://valley.dev',
            history: [],
            future: [],
            reloadKey: 9,
            status: 'embed-limited',
            title: 'Valley',
            favicon: null,
          },
        ],
        activeTabId: 'page',
        recents: [],
        bookmarks: [],
        collapsedSections: { resources: false, recents: false, bookmarks: false },
      }),
    );

    loadBrowserStorePersistedState();

    const tabs = useBrowserStore.getState().tabs;
    const home = tabs.find((t) => t.id === 'home');
    const page = tabs.find((t) => t.id === 'page');
    expect(home?.reloadKey).toBe(0);
    expect(home?.status).toBe('home');
    expect(page?.reloadKey).toBe(0);
    expect(page?.status).toBe('loading');
  });

  it('falls back to default state when stored payload is malformed', () => {
    storage.setItem(BROWSER_STORE_KEY, '{not valid json');

    expect(() => loadBrowserStorePersistedState()).not.toThrow();
    const state = useBrowserStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].currentUrl).toBeNull();
    expect(state.recents).toEqual([]);
  });

  it('drops history/future entries beyond 50 when persisting', () => {
    const longHistory = Array.from({ length: 80 }, (_, i) => `https://h.test/${i}`);
    const longFuture = Array.from({ length: 80 }, (_, i) => `https://f.test/${i}`);
    storage.setItem(
      BROWSER_STORE_KEY,
      JSON.stringify({
        tabs: [
          {
            id: 'one',
            currentUrl: 'https://current.test',
            addressInput: 'https://current.test',
            history: longHistory,
            future: longFuture,
            reloadKey: 0,
            status: 'loaded',
            title: null,
            favicon: null,
          },
        ],
        activeTabId: 'one',
        recents: [],
        bookmarks: [],
        collapsedSections: { resources: false, recents: false, bookmarks: false },
      }),
    );

    loadBrowserStorePersistedState();

    const tab = useBrowserStore.getState().tabs[0];
    expect(tab.history).toHaveLength(50);
    expect(tab.future).toHaveLength(50);
    expect(tab.history[0]).toBe(longHistory[longHistory.length - 50]);
    expect(tab.future[0]).toBe(longFuture[0]);
    expect(tab.future[tab.future.length - 1]).toBe(longFuture[49]);
  });

  it('uses default state when the v3 key is missing in localStorage', () => {
    expect(storage.getItem(BROWSER_STORE_KEY)).toBeNull();

    loadBrowserStorePersistedState();

    const state = useBrowserStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].currentUrl).toBeNull();
    expect(state.tabs[0].status).toBe('home');
    expect(state.activeTabId).toBe(state.tabs[0].id);
    expect(state.recents).toEqual([]);
    expect(state.bookmarks).toEqual([]);
    expect(state.collapsedSections).toEqual({
      resources: false,
      recents: false,
      bookmarks: false,
    });
  });

  it('does not migrate legacy non-v3 keys', () => {
    storage.setItem(
      'desktop-os-browser-v2',
      JSON.stringify({ tabs: [{ id: 'legacy', currentUrl: 'https://legacy.test' }] }),
    );
    storage.setItem(
      'desktop-os-browser',
      JSON.stringify({ url: 'https://very-old.test', bookmarks: [] }),
    );

    loadBrowserStorePersistedState();

    const state = useBrowserStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].currentUrl).toBeNull();
    expect(state.tabs[0].id).not.toBe('legacy');
    expect(state.bookmarks).toEqual([]);
    expect(storage.getItem('desktop-os-browser-v2')).not.toBeNull();
  });

  it('truncates history/future to 50 entries when writing snapshot', () => {
    useBrowserStore.getState().openUrl('https://seed.test');
    useBrowserStore.setState({
      tabs: useBrowserStore.getState().tabs.map((tab) => ({
        ...tab,
        history: Array.from({ length: 80 }, (_, i) => `https://h.test/${i}`),
        future: Array.from({ length: 80 }, (_, i) => `https://f.test/${i}`),
      })),
    });

    persistBrowserStoreSnapshot();

    const raw = storage.getItem(BROWSER_STORE_KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as {
      tabs: { history: string[]; future: string[] }[];
    };
    expect(persisted.tabs[0].history).toHaveLength(50);
    expect(persisted.tabs[0].future).toHaveLength(50);
    expect(persisted.tabs[0].history[0]).toBe('https://h.test/30');
    expect(persisted.tabs[0].future[49]).toBe('https://f.test/49');
  });

  it('survives a full write -> reload round trip with all v3 surfaces preserved', () => {
    useBrowserStore.getState().openUrl('https://valley.dev');
    useBrowserStore.getState().markLoaded({ title: 'Valley' });
    useBrowserStore.getState().addBookmark('https://valley.dev', 'Valley');
    useBrowserStore.getState().toggleSection('bookmarks');

    persistBrowserStoreSnapshot();

    __resetBrowserStoreForTests();
    expect(useBrowserStore.getState().bookmarks).toEqual([]);

    loadBrowserStorePersistedState();

    const state = useBrowserStore.getState();
    expect(state.tabs[0].currentUrl).toBe('https://valley.dev');
    expect(state.tabs[0].title).toBe('Valley');
    expect(state.tabs[0].status).toBe('loading');
    expect(state.tabs[0].reloadKey).toBe(0);
    expect(state.recents.map((r) => r.url)).toContain('https://valley.dev');
    expect(state.bookmarks.map((b) => b.url)).toContain('https://valley.dev');
    expect(state.collapsedSections.bookmarks).toBe(true);
  });
});
