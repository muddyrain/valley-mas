import type { Scenario } from '../types';

/**
 * 三国剧本：蜀汉、曹魏、东吴三家。
 * 用九宫格方位近似版图：曹魏占北方，蜀汉占西，东吴占东南；每家 3 个出生点。
 *
 * 测试用固定 seed：`sanguo-test-001`
 * 启动方式：在浏览器访问 `http://localhost:5173/?seed=sanguo-test-001`
 * 然后在 Sidebar 选择"三国鼎立"剧本，州数建议选 1000 或 3000。
 */
export const THREE_KINGDOMS_SCENARIO: Scenario = {
  id: 'three-kingdoms',
  name: '三国鼎立',
  description: '蜀汉据西、曹魏控北、东吴守东南，每家三个起始州。测试 seed: sanguo-test-001',
  factions: [
    {
      factionName: '蜀汉',
      leader: '刘备',
      colorHex: '#e05656',
      spawnProvinceIds: ['random:w', 'random:sw', 'random:center'],
    },
    {
      factionName: '曹魏',
      leader: '曹操',
      colorHex: '#3a82f6',
      spawnProvinceIds: ['random:n', 'random:ne', 'random:center'],
    },
    {
      factionName: '东吴',
      leader: '孙权',
      colorHex: '#4caf7c',
      spawnProvinceIds: ['random:e', 'random:se', 'random:center'],
    },
  ],
};

/**
 * 测试用 seed，生成不规则地图（含海洋/河流）用于本地验证。
 * 地图约 40-50% 为海洋，河流分布在陆地区域。
 */
export const THREE_KINGDOMS_TEST_SEED = 'sanguo-test-001';
