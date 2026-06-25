import type { StateCreator } from 'zustand';
import type { FactionId } from '@/shared/types';

export type PanelKey = 'factions' | 'log' | 'inspector';

export interface UiSlice {
  /** HUD 是否可见（录屏时切换） */
  hudVisible: boolean;
  /** 当前选中的势力 */
  selectedFactionId: FactionId | null;
  /** 当前打开的侧边面板集合 */
  openedPanels: Set<PanelKey>;
  /** 地图前线压力描边是否显示 */
  frontPressureOverlayVisible: boolean;
  /** 主题色调（Phase 1 仅 dark） */
  theme: 'dark';

  toggleHud: () => void;
  setHudVisible: (visible: boolean) => void;
  selectFaction: (id: FactionId | null) => void;
  setFrontPressureOverlayVisible: (visible: boolean) => void;
  toggleFrontPressureOverlay: () => void;
  togglePanel: (key: PanelKey) => void;
  openPanel: (key: PanelKey) => void;
  closePanel: (key: PanelKey) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  hudVisible: true,
  selectedFactionId: null,
  openedPanels: new Set<PanelKey>(['factions', 'log']),
  frontPressureOverlayVisible: false,
  theme: 'dark',

  toggleHud: () => set((s) => ({ hudVisible: !s.hudVisible })),
  setHudVisible: (visible) => set({ hudVisible: visible }),
  selectFaction: (id) => set({ selectedFactionId: id }),
  setFrontPressureOverlayVisible: (visible) => set({ frontPressureOverlayVisible: visible }),
  toggleFrontPressureOverlay: () =>
    set((s) => ({ frontPressureOverlayVisible: !s.frontPressureOverlayVisible })),
  togglePanel: (key) =>
    set((s) => {
      const next = new Set(s.openedPanels);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { openedPanels: next };
    }),
  openPanel: (key) =>
    set((s) => {
      if (s.openedPanels.has(key)) return {};
      const next = new Set(s.openedPanels);
      next.add(key);
      return { openedPanels: next };
    }),
  closePanel: (key) =>
    set((s) => {
      if (!s.openedPanels.has(key)) return {};
      const next = new Set(s.openedPanels);
      next.delete(key);
      return { openedPanels: next };
    }),
});
