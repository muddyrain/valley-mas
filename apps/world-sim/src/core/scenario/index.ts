import { BUILTIN_SCENARIOS, DEFAULT_SCENARIO_ID } from './presets';
import type { Scenario } from './types';

export type { ApplyScenarioOptions } from './apply';
export { applyScenarioToWorld } from './apply';
export type { WorldPolityPair } from './defaults';
export {
  DEFAULT_FACTION_NAME_POOL,
  DEFAULT_LEADER_POOL,
  NAME_LEADER_PRESET,
  WORLD_POLITY_PAIRS,
} from './defaults';
export { parseSpawnDirective } from './parse';
export {
  BUILTIN_SCENARIOS,
  CUSTOM_SCENARIO,
  DEFAULT_SCENARIO_ID,
  HISTORICAL_EMPERORS_SCENARIO,
  RANDOM_SCENARIO,
  THREE_KINGDOMS_SCENARIO,
} from './presets';
export type {
  Scenario,
  ScenarioApplyResult,
  ScenarioFaction,
  ScenarioFactionAssignment,
  ScenarioFactoryOptions,
  SpawnDirective,
  SpawnQuadrant,
} from './types';

const REGISTRY = new Map<string, Scenario>(BUILTIN_SCENARIOS.map((s) => [s.id, s]));

/** 注册或覆盖一个剧本（运行期扩展用，例如读取外部 JSON 文件） */
export function registerScenario(scenario: Scenario): void {
  REGISTRY.set(scenario.id, scenario);
}

/** 当前所有可用剧本（按注册顺序） */
export function listScenarios(): Scenario[] {
  return Array.from(REGISTRY.values());
}

export function getScenario(id: string): Scenario | null {
  return REGISTRY.get(id) ?? null;
}

export function resolveScenarioId(id: string | null | undefined): string {
  if (id != null && REGISTRY.has(id)) return id;
  return DEFAULT_SCENARIO_ID;
}
