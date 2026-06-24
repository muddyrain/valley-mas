import type { StateCreator } from 'zustand';
import {
  applyScenarioToWorld,
  DEFAULT_SCENARIO_ID,
  getScenario,
  listScenarios,
  resolveScenarioId,
  type Scenario,
  type ScenarioFactoryOptions,
} from '@/core/scenario';
import { createPrngFromSeed } from '@/shared/math';
import type { FactionSummary } from '@/shared/types';
import { asTick } from '@/shared/types';
import type { FactionSlice } from './factionSlice';
import { mintFactionId } from './factionSlice';
import type { MapSlice } from './mapSlice';
import type { ReplaySlice } from './replaySlice';
import type { SimSlice } from './simSlice';
import type { UiSlice } from './uiSlice';

export interface ScenarioSlice {
  /** 当前选中的剧本 id */
  currentScenarioId: string;
  /** 剧本应用次数；UI/渲染层可据此感知"刚加载过新剧本" */
  scenarioVersion: number;
  /** 上次应用剧本时无法满足的指令数（如随机不到州） */
  scenarioUnresolvedCount: number;
  /** 随机剧本的开关：是否启用中文/国外政体池 */
  randomScenarioOptions: Required<ScenarioFactoryOptions>;

  /** 切换并立即在当前地图上应用剧本 */
  loadScenario: (id: string) => void;
  /** 修改随机剧本开关；若当前正是 random，则立即重新加载 */
  setRandomScenarioOptions: (patch: Partial<ScenarioFactoryOptions>) => void;
  /** 列出所有剧本（含运行期注册） */
  listAvailableScenarios: () => Scenario[];
}

type Deps = ScenarioSlice & MapSlice & FactionSlice & SimSlice & UiSlice & ReplaySlice;

export const createScenarioSlice: StateCreator<Deps, [], [], ScenarioSlice> = (set, get) => ({
  currentScenarioId: DEFAULT_SCENARIO_ID,
  scenarioVersion: 0,
  scenarioUnresolvedCount: 0,
  randomScenarioOptions: { includeChinese: true, includeForeign: true },

  loadScenario: (id) => {
    const resolvedId = resolveScenarioId(id);
    const scenario = getScenario(resolvedId);
    const state = get();
    const map = state.map;

    // 没地图时只记录选择，等地图生成后由 mapSlice.regenerateMap 自动重放
    if (!map || !scenario) {
      set({ currentScenarioId: resolvedId });
      return;
    }

    const rng = createPrngFromSeed(`scenario-${map.meta.seed}-${resolvedId}`);
    // 动态剧本（如 random）通过 factionsFactory 每次抽不同的朝代/君主组合，
    // 静态剧本则继续使用 scenario.factions。
    const resolvedFactions = scenario.factionsFactory
      ? scenario.factionsFactory(rng, state.randomScenarioOptions)
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
      if (province) {
        province.ownerFactionId = entry.factionId;
      }
    }
    const nextMap = { ...map, provinces: nextProvinces };

    // 把每势力的 region 计数同步到 FactionSummary
    const regionsByFaction = new Map<number, number>();
    for (const entry of result.ownership) {
      const key = entry.factionId as unknown as number;
      regionsByFaction.set(key, (regionsByFaction.get(key) ?? 0) + 1);
    }

    const factionsNext: FactionSummary[] = result.factionAssignments.map((a) => ({
      id: a.factionId,
      name: a.factionName,
      leader: a.leader,
      colorHex: a.colorHex,
      birthRegionId: a.birthRegionId,
      capitalRegionId: a.birthRegionId,
      centroidRegionId: a.birthRegionId,
      regions: regionsByFaction.get(a.factionId as unknown as number) ?? 0,
      population: 0,
    }));

    set({
      map: nextMap,
      factions: factionsNext,
      currentScenarioId: resolvedId,
      scenarioVersion: state.scenarioVersion + 1,
      scenarioUnresolvedCount: result.unresolvedCount,
      // 加载剧本视为"刚开局"，把 sim 状态机复位回 idle
      tick: asTick(0),
      status: 'idle',
      winnerFactionId: null,
      lastTickEventCount: 0,
      snapshotVersion: state.snapshotVersion + 1,
      paused: true,
      selectedFactionId: null,
    });

    get().captureBaseline();
  },

  setRandomScenarioOptions: (patch) => {
    const prev = get().randomScenarioOptions;
    const next: Required<ScenarioFactoryOptions> = {
      includeChinese: patch.includeChinese ?? prev.includeChinese,
      includeForeign: patch.includeForeign ?? prev.includeForeign,
    };
    if (
      next.includeChinese === prev.includeChinese &&
      next.includeForeign === prev.includeForeign
    ) {
      return;
    }
    set({ randomScenarioOptions: next });
    // 当前正在玩 random 剧本则立即重抽，否则等下次切到 random 才生效
    if (get().currentScenarioId === 'random' && get().map) {
      get().loadScenario('random');
    }
  },

  listAvailableScenarios: () => listScenarios(),
});
