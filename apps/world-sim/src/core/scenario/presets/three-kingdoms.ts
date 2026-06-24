import type { Scenario } from '../types';

/**
 * 三国剧本：蜀汉、曹魏、东吴三家。
 * 用九宫格方位近似版图：曹魏占北方，蜀汉占西，东吴占东南；每家 2 个出生点（多出生点演示）。
 */
export const THREE_KINGDOMS_SCENARIO: Scenario = {
  id: 'three-kingdoms',
  name: '三国鼎立',
  description: '蜀汉据西、曹魏控北、东吴守东南，每家两个起始州。',
  factions: [
    {
      factionName: '蜀汉',
      leader: '刘备',
      colorHex: '#e05656',
      spawnProvinceIds: ['random:w', 'random:sw'],
    },
    {
      factionName: '曹魏',
      leader: '曹操',
      colorHex: '#3a82f6',
      spawnProvinceIds: ['random:n', 'random:ne'],
    },
    {
      factionName: '东吴',
      leader: '孙权',
      colorHex: '#4caf7c',
      spawnProvinceIds: ['random:e', 'random:se'],
    },
  ],
};
