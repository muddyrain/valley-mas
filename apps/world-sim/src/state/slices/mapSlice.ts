import type { StateCreator } from 'zustand';
import type { MapBounds, MapData } from '@/core/map';
import { defaultSeedSuffix, generateMap, getMapModeSource, type MapModeId } from '@/core/map';
import { rebuildCapitalSettlements } from '@/core/sim';
import type { RegionId } from '@/shared/types';
import { asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import type { ScenarioSlice } from './scenarioSlice';
import type { SettlementSlice } from './settlementSlice';
import type { SimSlice } from './simSlice';

// Re-export MapModeId for state layer consumers
export type { MapModeId };

export type ProvincePreset = 500 | 1000 | 2000 | 3000 | 10000;

export const PROVINCE_PRESETS: ProvincePreset[] = [500, 1000, 2000, 3000, 10000];

export const DEFAULT_MAP_BOUNDS: MapBounds = { width: 1920, height: 1200 };

export interface MapSlice {
  /** 当前生成的地图数据；首次进入页面也会自动生成 */
  map: MapData | null;
  /** 用户输入/选中的种子字符串 */
  seed: string;
  /** 当前预设州数 */
  provinceCount: ProvincePreset;
  /** 当前地图模式 */
  mapMode: MapModeId;
  /** 当前地图的剧本级 seed 后缀 */
  mapSeedSuffix: string;
  /** 命中测试得到的悬停州 */
  hoveredRegionId: RegionId | null;
  /** 用户点击选中的州 */
  selectedRegionId: RegionId | null;
  /** 上一次生成耗时（毫秒），仅供调试 HUD */
  lastGenerateMs: number;

  setSeed: (seed: string) => void;
  setProvinceCount: (count: ProvincePreset) => void;
  setMapMode: (
    mode: MapModeId,
    options?: { seedSuffix?: string; skipScenarioLoad?: boolean },
  ) => void;
  /** 重建地图 */
  regenerateMap: (overrides?: { seed?: string; provinceCount?: ProvincePreset }) => void;
  setHoveredRegion: (id: RegionId | null) => void;
  setSelectedRegion: (id: RegionId | null) => void;
}

type Deps = MapSlice & FactionSlice & SimSlice & ScenarioSlice & SettlementSlice;

const buildSimReset = () => ({
  tick: asTick(0),
  status: 'idle' as const,
  winnerFactionId: null,
  lastTickEventCount: 0,
  snapshotVersion: 0,
  recentConquests: new Map<number, ReturnType<typeof asTick>>(),
  activeWars: [],
  paused: true,
});

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

function getBoundsForMode(mode: MapModeId): MapBounds {
  return getMapModeSource(mode).bounds;
}

function getSeedForMode(mode: MapModeId, baseSeed: string, seedSuffix?: string): string {
  return baseSeed + (seedSuffix ?? defaultSeedSuffix(mode));
}

function buildMap(
  mode: MapModeId,
  seed: string,
  provinceCount: ProvincePreset,
  seedSuffix?: string,
): { map: MapData; elapsed: number } {
  const bounds = getBoundsForMode(mode);
  const effectiveSeed = getSeedForMode(mode, seed, seedSuffix);
  const start = performance.now();
  const next = generateMap({
    seed: effectiveSeed,
    provinceCount,
    bounds,
    relaxIterations: 2,
  });
  const elapsed = performance.now() - start;
  return { map: next, elapsed };
}

export const createMapSlice: StateCreator<Deps, [], [], MapSlice> = (set, get) => ({
  map: null,
  seed: generateInitialSeed(),
  provinceCount: 3000,
  mapMode: 'random',
  mapSeedSuffix: defaultSeedSuffix('random'),
  hoveredRegionId: null,
  selectedRegionId: null,
  lastGenerateMs: 0,

  setSeed: (seed) => set({ seed }),
  setProvinceCount: (count) => set({ provinceCount: count }),
  setMapMode: (mode, options) => {
    const { seed, provinceCount } = get();
    const seedSuffix = options?.seedSuffix ?? defaultSeedSuffix(mode);
    const { map, elapsed } = buildMap(mode, seed, provinceCount, seedSuffix);
    const factionsReset = get().factions.map((f) => ({
      ...f,
      birthRegionId: null,
      capitalRegionId: null,
      centroidRegionId: null,
      regions: 0,
    }));
    const settlementsReset = rebuildCapitalSettlements({
      map,
      factions: factionsReset,
      previous: get().settlements,
      tick: asTick(0),
    });
    set({
      map,
      mapMode: mode,
      mapSeedSuffix: seedSuffix,
      hoveredRegionId: null,
      selectedRegionId: null,
      lastGenerateMs: elapsed,
      factions: factionsReset,
      settlements: settlementsReset,
      ...buildSimReset(),
    });
    if (!options?.skipScenarioLoad) {
      get().loadScenario(get().currentScenarioId);
    }
  },
  regenerateMap: (overrides) => {
    const seed = overrides?.seed ?? get().seed;
    const provinceCount = overrides?.provinceCount ?? get().provinceCount;
    const mode = get().mapMode;
    const seedSuffix = get().mapSeedSuffix;
    const { map, elapsed } = buildMap(mode, seed, provinceCount, seedSuffix);
    const factionsReset = get().factions.map((f) => ({
      ...f,
      birthRegionId: null,
      capitalRegionId: null,
      centroidRegionId: null,
      regions: 0,
    }));
    const settlementsReset = rebuildCapitalSettlements({
      map,
      factions: factionsReset,
      previous: get().settlements,
      tick: asTick(0),
    });
    set({
      map,
      seed,
      provinceCount,
      hoveredRegionId: null,
      selectedRegionId: null,
      lastGenerateMs: elapsed,
      factions: factionsReset,
      settlements: settlementsReset,
      ...buildSimReset(),
    });
    // 地图生成完成后自动加载当前剧本：写入新的 factions 与 ownership。
    get().loadScenario(get().currentScenarioId);
  },

  setHoveredRegion: (id) => set({ hoveredRegionId: id }),
  setSelectedRegion: (id) => set({ selectedRegionId: id }),
});
