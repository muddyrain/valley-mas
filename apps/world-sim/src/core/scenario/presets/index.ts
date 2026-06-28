import type { Scenario } from '../types';
import { FOREIGN_POLITIES_SCENARIO } from './foreign-polities';
import { RANDOM_SCENARIO } from './random';
import { WARLORDS_SCENARIO } from './warlords';

/**
 * 内置剧本列表。新增剧本只需在此 push 即可让 UI 自动出现选项。
 * 外部 JSON 剧本可在运行期通过 registerScenario 追加（后续扩展）。
 */
export const BUILTIN_SCENARIOS: readonly Scenario[] = [
  RANDOM_SCENARIO,
  WARLORDS_SCENARIO,
  FOREIGN_POLITIES_SCENARIO,
];

export const DEFAULT_SCENARIO_ID: Scenario['id'] = RANDOM_SCENARIO.id;

export { FOREIGN_POLITIES_SCENARIO, RANDOM_SCENARIO, WARLORDS_SCENARIO };
