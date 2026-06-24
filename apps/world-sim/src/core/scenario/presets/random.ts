import type { Scenario } from '../types';

/**
 * 随机剧本：固定 4 家势力，全部走 random 出生指令。
 * 君主/颜色仍交给应用器兜底，方便用户后续手动改写。
 */
export const RANDOM_SCENARIO: Scenario = {
  id: 'random',
  name: '随机剧本',
  description: '随机生成 4 家势力，出生地随机分布。',
  factions: [
    { factionName: '势力·甲', spawnProvinceIds: ['random'] },
    { factionName: '势力·乙', spawnProvinceIds: ['random'] },
    { factionName: '势力·丙', spawnProvinceIds: ['random'] },
    { factionName: '势力·丁', spawnProvinceIds: ['random'] },
  ],
};
