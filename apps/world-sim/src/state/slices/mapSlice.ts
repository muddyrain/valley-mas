import type { StateCreator } from 'zustand';
import type { GeoMapId, MapBounds, MapData } from '@/core/map';
import { buildMapFromGeoJSON, defaultSeedFor, generateMap, getGeoMapSource } from '@/core/map';
import type { RegionId } from '@/shared/types';
import { asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import type { ScenarioSlice } from './scenarioSlice';
import type { SimSlice } from './simSlice';

export type ProvincePreset = 500 | 1000 | 2000 | 3000 | 10000;

export const PROVINCE_PRESETS: ProvincePreset[] = [500, 1000, 2000, 3000, 10000];

export const DEFAULT_MAP_BOUNDS: MapBounds = { width: 1920, height: 1200 };

/**
 * Phase 10：地图来源。'random' 走 Voronoi 生成器，其余 4 种走 GeoJSON 加载器。
 * 选项命名与 GeoMapId 完全对应，UI/状态层不再做映射。
 */
export type MapSourceId = 'random' | GeoMapId;

export interface LoadGeoMapOptions {
  /** 覆盖 source 默认 URL，便于切换 CDN 或本地缓存 */
  url?: string;
  /** 覆盖 seed；不传则使用 source 的稳定默认值 */
  seed?: string;
}

export interface MapSlice {
  /** 当前生成的地图数据；首次进入页面会自动生成 */
  map: MapData | null;
  /** 用户输入/选中的种子字符串 */
  seed: string;
  /** 当前预设州数（仅 random 模式生效） */
  provinceCount: ProvincePreset;
  /** 当前地图来源 */
  mapSource: MapSourceId;
  /** GeoJSON 模式下的 region 名（与 provinces 一一对应；random 模式为 null） */
  geoRegionNames: string[] | null;
  /** GeoJSON 加载状态：null / loading / error / ok */
  geoLoadStatus: 'idle' | 'loading' | 'ok' | 'error';
  /** GeoJSON 加载错误文案；ok / idle 时为 null */
  geoLoadError: string | null;
  /** 命中测试得到的悬停州 */
  hoveredRegionId: RegionId | null;
  /** 用户点击选中的州 */
  selectedRegionId: RegionId | null;
  /** 上一次生成耗时（毫秒），仅供调试 HUD */
  lastGenerateMs: number;

  setSeed: (seed: string) => void;
  setProvinceCount: (count: ProvincePreset) => void;
  /** 切回随机生成并立即重建地图 */
  regenerateMap: (overrides?: { seed?: string; provinceCount?: ProvincePreset }) => void;
  /** 加载 GeoJSON 地图并替换为该地图源 */
  loadGeoMap: (id: GeoMapId, options?: LoadGeoMapOptions) => Promise<void>;
  setHoveredRegion: (id: RegionId | null) => void;
  setSelectedRegion: (id: RegionId | null) => void;
}

type Deps = MapSlice & FactionSlice & SimSlice & ScenarioSlice;

const SIM_RESET = {
  tick: asTick(0),
  status: 'idle' as const,
  winnerFactionId: null,
  lastTickEventCount: 0,
  snapshotVersion: 0,
  paused: true,
};

/** 首次加载时生成随机 seed，保证每次进入页面地图和剧本都不同 */
function generateInitialSeed(): string {
  if (typeof window === 'undefined') return 'sanguo-001';
  // 支持 URL 参数 ?seed=xxx 指定 seed，便于分享和复现
  const params = new URLSearchParams(window.location.search);
  const urlSeed = params.get('seed');
  if (urlSeed && urlSeed.trim().length > 0) return urlSeed.trim();
  // 默认随机生成
  return `seed-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export const createMapSlice: StateCreator<Deps, [], [], MapSlice> = (set, get) => ({
  map: null,
  seed: generateInitialSeed(),
  provinceCount: 3000,
  mapSource: 'random',
  geoRegionNames: null,
  geoLoadStatus: 'idle',
  geoLoadError: null,
  hoveredRegionId: null,
  selectedRegionId: null,
  lastGenerateMs: 0,

  setSeed: (seed) => set({ seed }),
  setProvinceCount: (count) => set({ provinceCount: count }),
  regenerateMap: (overrides) => {
    const seed = overrides?.seed ?? get().seed;
    const provinceCount = overrides?.provinceCount ?? get().provinceCount;
    const start = performance.now();
    const next = generateMap({
      seed,
      provinceCount,
      bounds: DEFAULT_MAP_BOUNDS,
      relaxIterations: 2,
    });
    const elapsed = performance.now() - start;
    const factionsReset = get().factions.map((f) => ({
      ...f,
      birthRegionId: null,
      capitalRegionId: null,
      centroidRegionId: null,
      regions: 0,
    }));
    set({
      map: next,
      seed,
      provinceCount,
      mapSource: 'random',
      geoRegionNames: null,
      geoLoadStatus: 'idle',
      geoLoadError: null,
      hoveredRegionId: null,
      selectedRegionId: null,
      lastGenerateMs: elapsed,
      factions: factionsReset,
      ...SIM_RESET,
    });
    // 地图生成完成后自动加载当前剧本：写入新的 factions 与 ownership。
    get().loadScenario(get().currentScenarioId);
  },

  loadGeoMap: async (id, options) => {
    const source = getGeoMapSource(id);
    const url = options?.url ?? source.defaultUrl;
    const seed = options?.seed ?? defaultSeedFor(id);

    set({
      mapSource: id,
      geoLoadStatus: 'loading',
      geoLoadError: null,
    });

    try {
      const start = performance.now();
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const raw = await res.json();
      const built = buildMapFromGeoJSON(raw, {
        seed,
        bounds: source.bounds,
        nameProperty: source.nameProperty,
      });
      const elapsed = performance.now() - start;

      const factionsReset = get().factions.map((f) => ({
        ...f,
        birthRegionId: null,
        capitalRegionId: null,
        centroidRegionId: null,
        regions: 0,
      }));

      set({
        map: built.map,
        seed,
        mapSource: id,
        geoRegionNames: built.regionNames,
        geoLoadStatus: 'ok',
        geoLoadError: null,
        hoveredRegionId: null,
        selectedRegionId: null,
        lastGenerateMs: elapsed,
        factions: factionsReset,
        ...SIM_RESET,
      });
      get().loadScenario(get().currentScenarioId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({
        geoLoadStatus: 'error',
        geoLoadError: `加载 ${source.name} 失败：${message}`,
      });
    }
  },

  setHoveredRegion: (id) => set({ hoveredRegionId: id }),
  setSelectedRegion: (id) => set({ selectedRegionId: id }),
});
