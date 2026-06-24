import type { Scenario } from '../types';

/**
 * 自定义剧本：占位剧本，后续可由用户在 UI 自行编辑或从外部 JSON 注入。
 * 当前仅含一家空白势力，应用时由兜底逻辑随机分配出生州。
 */
export const CUSTOM_SCENARIO: Scenario = {
  id: 'custom',
  name: '自定义剧本',
  description: '保留扩展位：可在 UI 编辑或从外部文件加载自定义剧本。',
  factions: [
    {
      factionName: '自定义势力',
      spawnProvinceIds: ['random'],
    },
  ],
};
