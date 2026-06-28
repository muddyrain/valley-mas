import type { StateCreator } from 'zustand';
import { defaultSeedSuffix } from '@/core/map';
import {
  applyScenarioToWorld,
  DEFAULT_SCENARIO_ID,
  getScenario,
  listScenarios,
  resolveScenarioId,
  type Scenario,
} from '@/core/scenario';
import { rebuildCapitalSettlements } from '@/core/sim';
import { createPrngFromSeed } from '@/shared/math';
import type { FactionSummary } from '@/shared/types';
import { asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import { mintFactionId } from './factionSlice';
import type { MapSlice } from './mapSlice';
import type { ReplaySlice } from './replaySlice';
import type { SettlementSlice } from './settlementSlice';
import type { SimSlice } from './simSlice';
import type { UiSlice } from './uiSlice';

export interface ScenarioSlice {
  /** 当前选中的剧本 id */
  currentScenarioId: string;
  /** 剧本应用次数；UI/渲染层可据此感知"刚加载过新剧本" */
  scenarioVersion: number;
  /** 上次应用剧本时无法满足的指令数（如随机不到州） */
  scenarioUnresolvedCount: number;

  /** 切换并立即在当前地图上应用剧本 */
  loadScenario: (id: string) => void;
  /** 列出所有剧本（含运行期注册） */
  listAvailableScenarios: () => Scenario[];
}

type Deps = ScenarioSlice &
  MapSlice &
  FactionSlice &
  SimSlice &
  UiSlice &
  ReplaySlice &
  SettlementSlice;

export const createScenarioSlice: StateCreator<Deps, [], [], ScenarioSlice> = (set, get) => ({
  currentScenarioId: DEFAULT_SCENARIO_ID,
  scenarioVersion: 0,
  scenarioUnresolvedCount: 0,

  loadScenario: (id) => {
    const resolvedId = resolveScenarioId(id);
    const scenario = getScenario(resolvedId);
    let state = get();
    let map = state.map;

    // 没地图时只记录选择，等地图生成后由 mapSlice.regenerateMap 自动重放
    if (!map || !scenario) {
      set({ currentScenarioId: resolvedId });
      return;
    }

    const preferredMapMode = scenario.preferredMapMode ?? state.mapMode;
    const mapSeedSuffix = scenario.mapSeedSuffix ?? defaultSeedSuffix(preferredMapMode);
    if (state.mapMode !== preferredMapMode || state.mapSeedSuffix !== mapSeedSuffix) {
      state.setMapMode(preferredMapMode, {
        seedSuffix: mapSeedSuffix,
        skipScenarioLoad: true,
      });
      state = get();
      map = state.map;
      if (!map) {
        set({ currentScenarioId: resolvedId });
        return;
      }
    }

    const rng = createPrngFromSeed(`scenario-${map.meta.seed}-${resolvedId}`);
    // 动态剧本（如 random）通过 factionsFactory 每次抽不同的朝代/君主组合，
    // 静态剧本则继续使用 scenario.factions。
    const resolvedFactions = scenario.factionsFactory
      ? scenario.factionsFactory(rng, scenario.factoryOptions)
      : scenario.factions;
    const result = applyScenarioToWorld({
      map,
      scenario: { ...scenario, factions: resolvedFactions },
      rng,
      mintFactionId,
    });

    // 写回 ownership：先清空所有 owner，再按 result.ownership 覆盖
    const nextProvinces = map.provinces.map((p) => ({
      ...p,
      ownerFactionId: null as typeof p.ownerFactionId,
    }));
    for (const entry of result.ownership) {
      const idx = entry.regionId as unknown as number;
      const province = nextProvinces[idx];
      if (province && province.terrain !== 'ocean') {
        province.ownerFactionId = entry.factionId;
      }
    }
    const nextMap = { ...map, provinces: nextProvinces };

    // 把每势力的 region 计数同步到 FactionSummary
    const regionsByFaction = new Map<number, number>();
    for (const province of nextProvinces) {
      if (province.terrain === 'ocean' || province.ownerFactionId == null) continue;
      const key = province.ownerFactionId as unknown as number;
      regionsByFaction.set(key, (regionsByFaction.get(key) ?? 0) + 1);
    }

    const factionsNext: FactionSummary[] = result.factionAssignments.map((a) => ({
      id: a.factionId,
      name: a.factionName,
      leader: a.leader,
      colorHex: a.colorHex,
      birthRegionId: isOwnedLandBy(nextProvinces, a.birthRegionId, a.factionId)
        ? a.birthRegionId
        : null,
      capitalRegionId: isOwnedLandBy(nextProvinces, a.birthRegionId, a.factionId)
        ? a.birthRegionId
        : null,
      centroidRegionId: isOwnedLandBy(nextProvinces, a.birthRegionId, a.factionId)
        ? a.birthRegionId
        : null,
      regions: regionsByFaction.get(a.factionId as unknown as number) ?? 0,
      population: 0,
    }));
    const settlementsNext = rebuildCapitalSettlements({
      map: nextMap,
      factions: factionsNext,
      previous: state.settlements,
      tick: asTick(0),
    });

    set({
      map: nextMap,
      factions: factionsNext,
      settlements: settlementsNext,
      currentScenarioId: resolvedId,
      scenarioVersion: state.scenarioVersion + 1,
      scenarioUnresolvedCount: result.unresolvedCount,
      // 加载剧本视为"刚开局"，把 sim 状态机复位回 idle
      tick: asTick(0),
      status: 'idle',
      winnerFactionId: null,
      lastTickEventCount: 0,
      recentConquests: new Map(),
      activeWars: [],
      snapshotVersion: state.snapshotVersion + 1,
      paused: true,
      selectedFactionId: null,
    });

    get().captureBaseline();
  },

  listAvailableScenarios: () => listScenarios(),
});

function isOwnedLandBy(
  provinces: Array<{ terrain: string; ownerFactionId: FactionSummary['id'] | null }>,
  regionId: FactionSummary['birthRegionId'],
  factionId: FactionSummary['id'],
): boolean {
  if (regionId == null) return false;
  const province = provinces[regionId as unknown as number];
  return province?.terrain !== 'ocean' && province?.ownerFactionId === factionId;
}
