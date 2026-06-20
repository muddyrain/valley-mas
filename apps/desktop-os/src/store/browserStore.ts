import { create } from 'zustand';

export const SAFARI_HOME_URL = 'plush://start';

export type BrowserStatus = 'home' | 'loading' | 'loaded' | 'embed-limited';

interface BrowserStore {
  currentUrl: string | null;
  addressInput: string;
  history: string[];
  future: string[];
  reloadKey: number;
  status: BrowserStatus;
  openUrl: (url: string) => void;
  goHome: () => void;
  goBack: () => void;
  goForward: () => void;
  refresh: () => void;
  setAddressInput: (value: string) => void;
  markLoaded: () => void;
  markEmbedLimited: () => void;
}

export const useBrowserStore = create<BrowserStore>((set, get) => ({
  currentUrl: null,
  addressInput: SAFARI_HOME_URL,
  history: [],
  future: [],
  reloadKey: 0,
  status: 'home',

  openUrl: (url) => {
    const next = normalizeAddress(url);
    const { currentUrl, history } = get();
    if (next === SAFARI_HOME_URL) {
      set({
        currentUrl: null,
        addressInput: SAFARI_HOME_URL,
        future: [],
        status: 'home',
      });
      return;
    }
    set({
      currentUrl: next,
      addressInput: next,
      history: currentUrl ? [...history, currentUrl] : history,
      future: [],
      reloadKey: 0,
      status: 'loading',
    });
  },

  goHome: () => {
    const { currentUrl, history } = get();
    set({
      currentUrl: null,
      addressInput: SAFARI_HOME_URL,
      history: currentUrl ? [...history, currentUrl] : history,
      future: [],
      status: 'home',
    });
  },

  goBack: () => {
    const { currentUrl, history, future } = get();
    const previous = history.at(-1);
    if (!previous) return;
    set({
      currentUrl: previous,
      addressInput: previous,
      history: history.slice(0, -1),
      future: currentUrl ? [currentUrl, ...future] : future,
      reloadKey: 0,
      status: 'loading',
    });
  },

  goForward: () => {
    const { currentUrl, history, future } = get();
    const next = future[0];
    if (!next) return;
    set({
      currentUrl: next,
      addressInput: next,
      history: currentUrl ? [...history, currentUrl] : history,
      future: future.slice(1),
      reloadKey: 0,
      status: 'loading',
    });
  },

  refresh: () => {
    const { currentUrl, reloadKey } = get();
    if (!currentUrl) return;
    set({ reloadKey: reloadKey + 1, status: 'loading' });
  },

  setAddressInput: (value) => set({ addressInput: value }),
  markLoaded: () => set({ status: 'loaded' }),
  markEmbedLimited: () => {
    const { currentUrl, status } = get();
    if (!currentUrl || status !== 'loading') return;
    set({ status: 'embed-limited' });
  },
}));

export function normalizeAddress(raw: string) {
  const value = raw.trim();
  if (!value || value === SAFARI_HOME_URL) return SAFARI_HOME_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.includes('.') && !value.includes(' ')) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}
