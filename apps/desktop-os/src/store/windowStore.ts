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

export type WindowLifecycleState = 'active' | 'minimized' | 'closing';

export interface WindowState extends WindowRect {
  id: string;
  appId: AppId;
  title: string;
  zIndex: number;
  minimized: boolean;
  lifecycleState: WindowLifecycleState;
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
  runningAppIds: AppId[];
  visibleAppIds: AppId[];
  activeAppIds: AppId[];
  topZ: number;
  focusedId: string | null;
  focusedAppId: AppId | null;
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

export function deriveRunningAppIds(windows: WindowState[]) {
  const appIds: AppId[] = [];
  for (const windowState of windows) {
    if (!appIds.includes(windowState.appId)) appIds.push(windowState.appId);
  }
  return appIds;
}

export function deriveVisibleAppIds(windows: WindowState[]) {
  const appIds: AppId[] = [];
  for (const windowState of windows) {
    if (windowState.lifecycleState === 'minimized' || windowState.minimized) continue;
    if (!appIds.includes(windowState.appId)) appIds.push(windowState.appId);
  }
  return appIds;
}

export function deriveActiveAppIds(windows: WindowState[]) {
  return deriveVisibleAppIds(windows);
}

function deriveLifecycleAppState(windows: WindowState[]) {
  return {
    runningAppIds: deriveRunningAppIds(windows),
    visibleAppIds: deriveVisibleAppIds(windows),
    activeAppIds: deriveActiveAppIds(windows),
  };
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: [],
  runningAppIds: [],
  visibleAppIds: [],
  activeAppIds: [],
  topZ: 10,
  focusedId: null,
  focusedAppId: null,
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
      const nextWindow: WindowState = {
        id,
        appId,
        title: options.title ?? appId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        zIndex: z,
        minimized: false,
        lifecycleState: 'active',
        maximized: false,
      };
      const windows = [...state.windows, nextWindow];
      return {
        topZ: z,
        focusedId: id,
        focusedAppId: appId,
        windows,
        ...deriveLifecycleAppState(windows),
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
      const focusedAppId = next.find((w) => w.id === focusedId)?.appId ?? null;
      return { windows: next, focusedId, focusedAppId, ...deriveLifecycleAppState(next) };
    }),

  focusWindow: (id) =>
    set((state) => {
      const z = state.topZ + 1;
      const focusedAppId = state.windows.find((w) => w.id === id)?.appId ?? state.focusedAppId;
      const windows: WindowState[] = state.windows.map((w) =>
        w.id === id ? { ...w, zIndex: z, minimized: false, lifecycleState: 'active' as const } : w,
      );
      return {
        topZ: z,
        focusedId: id,
        focusedAppId,
        windows,
        ...deriveLifecycleAppState(windows),
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
      const next: WindowState[] = state.windows.map((w) =>
        w.id === id ? { ...w, minimized: true, lifecycleState: 'minimized' as const } : w,
      );
      const focusedId =
        state.focusedId === id
          ? (next.reduce<WindowState | null>(
              (acc, w) => (!w.minimized && (!acc || w.zIndex > acc.zIndex) ? w : acc),
              null,
            )?.id ?? null)
          : state.focusedId;
      const focusedAppId = next.find((w) => w.id === focusedId)?.appId ?? null;
      return { windows: next, focusedId, focusedAppId, ...deriveLifecycleAppState(next) };
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
