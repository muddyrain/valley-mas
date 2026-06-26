import type { Scenario } from '../types';
import { CUSTOM_SCENARIO } from './custom';
import { RANDOM_SCENARIO } from './random';
import { THREE_KINGDOMS_SCENARIO } from './three-kingdoms';
import { WARLORDS_SCENARIO } from './warlords';

/**
 * 内置剧本列表。新增剧本只需在此 push 即可让 UI 自动出现选项。
 * 外部 JSON 剧本可在运行期通过 registerScenario 追加（后续扩展）。
 */
export const BUILTIN_SCENARIOS: readonly Scenario[] = [
  RANDOM_SCENARIO,
  THREE_KINGDOMS_SCENARIO,
  WARLORDS_SCENARIO,
  CUSTOM_SCENARIO,
];

export const DEFAULT_SCENARIO_ID: Scenario['id'] = RANDOM_SCENARIO.id;

export { CUSTOM_SCENARIO, RANDOM_SCENARIO, THREE_KINGDOMS_SCENARIO, WARLORDS_SCENARIO };
