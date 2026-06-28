import type { StateCreator } from 'zustand';
import type { TerrainKind } from '@/core/map';
import type { FactionId, RegionId } from '@/shared/types';

export type PanelKey = 'factions' | 'log' | 'inspector';
export type SettlementStabilityOverlayMode = 'none' | 'loyalty' | 'unrest';
export type DivineTerrainKind = Exclude<TerrainKind, 'ocean'>;
export type DivineTool =
  | 'none'
  | 'bless-settlement'
  | 'curse-settlement'
  | 'incite-revolt'
  | 'pacify-unrest'
  | 'accelerate-civilization'
  | 'strike-disaster'
  | 'freeze-war'
  | 'terraform-region';

export interface DivineFeedback {
  regionId: RegionId;
  tool: Exclude<DivineTool, 'none'>;
  sequence: number;
}

export interface UiSlice {
  /** HUD 是否可见（录屏时切换） */
  hudVisible: boolean;
  /** 当前选中的势力 */
  selectedFactionId: FactionId | null;
  /** 当前打开的侧边面板集合 */
  openedPanels: Set<PanelKey>;
  /** 地图前线压力描边是否显示 */
  frontPressureOverlayVisible: boolean;
  /** 地图行政距离热力是否显示 */
  adminDistanceOverlayVisible: boolean;
  /** 地图战争/停战边界是否显示 */
  warStatusOverlayVisible: boolean;
  /** 地图聚落围城热力是否显示 */
  siegeProgressOverlayVisible: boolean;
  /** 地图地理战略价值热力是否显示 */
  strategicValueOverlayVisible: boolean;
  /** 聚落稳定性热力模式 */
  settlementStabilityOverlayMode: SettlementStabilityOverlayMode;
  /** 当前神力工具 */
  divineTool: DivineTool;
  /** 改变地形神力的目标陆地地形 */
  divineTerrain: DivineTerrainKind;
  /** 最近一次成功神力的短反馈目标 */
  divineFeedback: DivineFeedback | null;
  /** 调试摘要面板是否显示 */
  debugPanelVisible: boolean;
  /** 主题色调（Phase 1 仅 dark） */
  theme: 'dark';

  toggleHud: () => void;
  setHudVisible: (visible: boolean) => void;
  selectFaction: (id: FactionId | null) => void;
  setFrontPressureOverlayVisible: (visible: boolean) => void;
  toggleFrontPressureOverlay: () => void;
  setAdminDistanceOverlayVisible: (visible: boolean) => void;
  toggleAdminDistanceOverlay: () => void;
  setWarStatusOverlayVisible: (visible: boolean) => void;
  toggleWarStatusOverlay: () => void;
  setSiegeProgressOverlayVisible: (visible: boolean) => void;
  toggleSiegeProgressOverlay: () => void;
  setStrategicValueOverlayVisible: (visible: boolean) => void;
  toggleStrategicValueOverlay: () => void;
  setSettlementStabilityOverlayMode: (mode: SettlementStabilityOverlayMode) => void;
  toggleSettlementStabilityOverlay: (mode: Exclude<SettlementStabilityOverlayMode, 'none'>) => void;
  setDivineTool: (tool: DivineTool) => void;
  toggleDivineTool: (tool: Exclude<DivineTool, 'none'>) => void;
  setDivineTerrain: (terrain: DivineTerrainKind) => void;
  recordDivineFeedback: (regionId: RegionId, tool: Exclude<DivineTool, 'none'>) => void;
  clearDivineFeedback: () => void;
  setDebugPanelVisible: (visible: boolean) => void;
  toggleDebugPanel: () => void;
  togglePanel: (key: PanelKey) => void;
  openPanel: (key: PanelKey) => void;
  closePanel: (key: PanelKey) => void;
}

export const createUiSlice: StateCreator<UiSlice, [], [], UiSlice> = (set) => ({
  hudVisible: true,
  selectedFactionId: null,
  openedPanels: new Set<PanelKey>(['factions', 'log']),
  frontPressureOverlayVisible: false,
  adminDistanceOverlayVisible: false,
  warStatusOverlayVisible: false,
  siegeProgressOverlayVisible: false,
  strategicValueOverlayVisible: false,
  settlementStabilityOverlayMode: 'none',
  divineTool: 'none',
  divineTerrain: 'forest',
  divineFeedback: null,
  debugPanelVisible: false,
  theme: 'dark',

  toggleHud: () => set((s) => ({ hudVisible: !s.hudVisible })),
  setHudVisible: (visible) => set({ hudVisible: visible }),
  selectFaction: (id) => set({ selectedFactionId: id }),
  setFrontPressureOverlayVisible: (visible) => set({ frontPressureOverlayVisible: visible }),
  toggleFrontPressureOverlay: () =>
    set((s) => ({ frontPressureOverlayVisible: !s.frontPressureOverlayVisible })),
  setAdminDistanceOverlayVisible: (visible) => set({ adminDistanceOverlayVisible: visible }),
  toggleAdminDistanceOverlay: () =>
    set((s) => ({ adminDistanceOverlayVisible: !s.adminDistanceOverlayVisible })),
  setWarStatusOverlayVisible: (visible) => set({ warStatusOverlayVisible: visible }),
  toggleWarStatusOverlay: () =>
    set((s) => ({ warStatusOverlayVisible: !s.warStatusOverlayVisible })),
  setSiegeProgressOverlayVisible: (visible) => set({ siegeProgressOverlayVisible: visible }),
  toggleSiegeProgressOverlay: () =>
    set((s) => ({ siegeProgressOverlayVisible: !s.siegeProgressOverlayVisible })),
  setStrategicValueOverlayVisible: (visible) => set({ strategicValueOverlayVisible: visible }),
  toggleStrategicValueOverlay: () =>
    set((s) => ({ strategicValueOverlayVisible: !s.strategicValueOverlayVisible })),
  setSettlementStabilityOverlayMode: (mode) => set({ settlementStabilityOverlayMode: mode }),
  toggleSettlementStabilityOverlay: (mode) =>
    set((s) => ({
      settlementStabilityOverlayMode: s.settlementStabilityOverlayMode === mode ? 'none' : mode,
    })),
  setDivineTool: (tool) => set({ divineTool: tool }),
  toggleDivineTool: (tool) =>
    set((s) => ({
      divineTool: s.divineTool === tool ? 'none' : tool,
    })),
  setDivineTerrain: (terrain) => set({ divineTerrain: terrain }),
  recordDivineFeedback: (regionId, tool) =>
    set((s) => ({
      divineFeedback: {
        regionId,
        tool,
        sequence: (s.divineFeedback?.sequence ?? 0) + 1,
      },
    })),
  clearDivineFeedback: () => set({ divineFeedback: null }),
  setDebugPanelVisible: (visible) => set({ debugPanelVisible: visible }),
  toggleDebugPanel: () => set((s) => ({ debugPanelVisible: !s.debugPanelVisible })),
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
