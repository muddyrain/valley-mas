import { create } from 'zustand';
import type { DesktopAppId } from '../apps/desktopApps';
import {
  clampWindowRect,
  DOCK_RESERVED_HEIGHT,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  resolveOpenWindowRect,
  TOP_BAR_HEIGHT,
} from './windowSizing';

export type AppId = DesktopAppId;

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
  lastRects: Partial<Record<AppId, WindowRect>>;

  openWindow: (appId: AppId, options?: OpenOptions) => string;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, rect: Partial<WindowRect>) => void;
  minimizeWindow: (id: string) => void;
  toggleMaximize: (id: string, viewport: { width: number; height: number }) => void;
  restoreOrFocus: (appId: AppId, options?: OpenOptions) => void;
}

let windowSeq = 0;
const nextId = (appId: AppId) => `${appId}-${++windowSeq}`;
const toRect = (windowState: WindowState): WindowRect => ({
  x: windowState.x,
  y: windowState.y,
  width: windowState.width,
  height: windowState.height,
});

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  topZ: 10,
  focusedId: null,
  lastRects: {},

  openWindow: (appId, options = {}) => {
    const id = nextId(appId);
    set((state) => {
      const z = state.topZ + 1;
      const rect = resolveOpenWindowRect(
        appId,
        options,
        { width: window.innerWidth, height: window.innerHeight },
        state.windows.filter((w) => w.appId === appId).length,
        state.lastRects[appId],
      );
      return {
        topZ: z,
        focusedId: id,
        windows: [
          ...state.windows,
          {
            id,
            appId,
            title: options.title ?? appId,
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
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
    set((state) => {
      const windows = state.windows.map((w) => {
        if (w.id !== id) return w;
        return { ...w, x, y, maximized: false };
      });
      const movedWindow = windows.find((w) => w.id === id);

      return {
        windows,
        lastRects: movedWindow
          ? { ...state.lastRects, [movedWindow.appId]: toRect(movedWindow) }
          : state.lastRects,
      };
    }),

  resizeWindow: (id, rect) =>
    set((state) => {
      const windows = state.windows.map((w) => {
        if (w.id !== id) return w;
        const next: WindowState = {
          ...w,
          x: rect.x ?? w.x,
          y: rect.y ?? w.y,
          width: Math.max(MIN_WINDOW_WIDTH, rect.width ?? w.width),
          height: Math.max(MIN_WINDOW_HEIGHT, rect.height ?? w.height),
          maximized: false,
        };
        return next;
      });
      const resizedWindow = windows.find((w) => w.id === id);

      return {
        windows,
        lastRects: resizedWindow
          ? { ...state.lastRects, [resizedWindow.appId]: toRect(resizedWindow) }
          : state.lastRects,
      };
    }),

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
    set((state) => {
      const windows = state.windows.map((w) => {
        if (w.id !== id) return w;
        if (w.maximized && w.prevRect) {
          return {
            ...w,
            ...clampWindowRect(w.prevRect, viewport),
            maximized: false,
            prevRect: undefined,
          };
        }
        return {
          ...w,
          prevRect: { x: w.x, y: w.y, width: w.width, height: w.height },
          x: 0,
          y: TOP_BAR_HEIGHT,
          width: viewport.width,
          height: viewport.height - TOP_BAR_HEIGHT - DOCK_RESERVED_HEIGHT,
          maximized: true,
        };
      });
      const restoredWindow = windows.find((w) => w.id === id && !w.maximized);

      return {
        windows,
        lastRects: restoredWindow
          ? { ...state.lastRects, [restoredWindow.appId]: toRect(restoredWindow) }
          : state.lastRects,
      };
    }),

  restoreOrFocus: (appId, options) => {
    const { windows, focusWindow, openWindow } = get();
    const existing = windows.find((w) => w.appId === appId);
    if (existing) {
      focusWindow(existing.id);
    } else {
      openWindow(appId, options);
    }
  },
}));
