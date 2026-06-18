import { create } from 'zustand';

export type AppId = 'about' | 'finder' | 'notes';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState extends WindowRect {
  id: string;
  appId: AppId;
  title: string;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  // 保存最大化前的位置/尺寸，方便 restore
  prevRect?: WindowRect;
}

export interface OpenOptions {
  title?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

interface WindowStore {
  windows: WindowState[];
  topZ: number;
  focusedId: string | null;

  openWindow: (appId: AppId, options?: OpenOptions) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, rect: Partial<WindowRect>) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string, viewport: { width: number; height: number }) => void;
  restoreOrFocus: (appId: AppId) => void;
}

const MIN_W = 320;
const MIN_H = 200;
const TOP_BAR_H = 28;
const DOCK_RESERVED_H = 96;

let windowSeq = 0;
const nextId = (appId: AppId) => `${appId}-${++windowSeq}`;

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  topZ: 10,
  focusedId: null,

  openWindow: (appId, options = {}) => {
    const id = nextId(appId);
    set((state) => {
      const z = state.topZ + 1;
      const w = options.width ?? 480;
      const h = options.height ?? 320;
      const x = options.x ?? Math.max(60, (window.innerWidth - w) / 2);
      const y = options.y ?? Math.max(60, (window.innerHeight - h) / 2 - 40);
      return {
        topZ: z,
        focusedId: id,
        windows: [
          ...state.windows,
          {
            id,
            appId,
            title: options.title ?? appId,
            x,
            y,
            width: w,
            height: h,
            zIndex: z,
            minimized: false,
            maximized: false,
          },
        ],
      };
    });
    return id;
  },

  closeWindow: (id) =>
    set((state) => {
      const next = state.windows.filter((w) => w.id !== id);
      const focusedId =
        state.focusedId === id
          ? (next.reduce<WindowState | null>(
              (acc, w) => (!w.minimized && (!acc || w.zIndex > acc.zIndex) ? w : acc),
              null,
            )?.id ?? null)
          : state.focusedId;
      return { windows: next, focusedId };
    }),

  focusWindow: (id) =>
    set((state) => {
      const z = state.topZ + 1;
      return {
        topZ: z,
        focusedId: id,
        windows: state.windows.map((w) =>
          w.id === id ? { ...w, zIndex: z, minimized: false } : w,
        ),
      };
    }),

  moveWindow: (id, x, y) =>
    set((state) => ({
      windows: state.windows.map((w) => (w.id === id ? { ...w, x, y, maximized: false } : w)),
    })),

  resizeWindow: (id, rect) =>
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== id) return w;
        const next: WindowState = {
          ...w,
          x: rect.x ?? w.x,
          y: rect.y ?? w.y,
          width: Math.max(MIN_W, rect.width ?? w.width),
          height: Math.max(MIN_H, rect.height ?? w.height),
          maximized: false,
        };
        return next;
      }),
    })),

  minimizeWindow: (id) =>
    set((state) => {
      const next = state.windows.map((w) => (w.id === id ? { ...w, minimized: true } : w));
      const focusedId =
        state.focusedId === id
          ? (next.reduce<WindowState | null>(
              (acc, w) => (!w.minimized && (!acc || w.zIndex > acc.zIndex) ? w : acc),
              null,
            )?.id ?? null)
          : state.focusedId;
      return { windows: next, focusedId };
    }),

  toggleMaximize: (id, viewport) =>
    set((state) => ({
      windows: state.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized && w.prevRect) {
          return {
            ...w,
            ...w.prevRect,
            maximized: false,
            prevRect: undefined,
          };
        }
        return {
          ...w,
          prevRect: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: TOP_BAR_H,
          width: viewport.width,
          height: viewport.height - TOP_BAR_H - DOCK_RESERVED_H,
          maximized: true,
        };
      }),
    })),

  restoreOrFocus: (appId) => {
    const { windows, focusWindow, openWindow } = get();
    const existing = windows.find((w) => w.appId === appId);
    if (existing) {
      focusWindow(existing.id);
    } else {
      openWindow(appId);
    }
  },
}));
