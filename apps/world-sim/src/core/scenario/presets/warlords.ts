import type { Scenario } from '../types';

/**
 * 群雄逐鹿剧本：东汉末年八大诸侯。
 * 用九宫格方位分配出生区域，模拟汉末群雄割据局面。
 */
export const WARLORDS_SCENARIO: Scenario = {
  id: 'warlords',
  name: '群雄逐鹿',
  description: '东汉末年八大诸侯割据：曹操、刘备、孙权、袁绍、吕布、董卓、马腾、刘表。',
  factions: [
    {
      factionName: '曹魏',
      leader: '曹操',
      colorHex: '#3a82f6',
      spawnProvinceIds: ['random:n', 'random:center'],
    },
    {
      factionName: '蜀汉',
      leader: '刘备',
      colorHex: '#e05656',
      spawnProvinceIds: ['random:w', 'random:sw'],
    },
    {
      factionName: '东吴',
      leader: '孙权',
      colorHex: '#4caf7c',
      spawnProvinceIds: ['random:e', 'random:se'],
    },
    {
      factionName: '袁绍',
      leader: '袁绍',
      colorHex: '#f5b942',
      spawnProvinceIds: ['random:ne'],
    },
    {
      factionName: '吕布',
      leader: '吕布',
      colorHex: '#a05fd0',
      spawnProvinceIds: ['random:center'],
    },
    {
      factionName: '董卓',
      leader: '董卓',
      colorHex: '#e08a3a',
      spawnProvinceIds: ['random:nw'],
    },
    {
      factionName: '马腾',
      leader: '马腾',
      colorHex: '#36c2c4',
      spawnProvinceIds: ['random:nw', 'random:w'],
    },
    {
      factionName: '刘表',
      leader: '刘表',
      colorHex: '#7a86c2',
      spawnProvinceIds: ['random:sw', 'random:se'],
    },
  ],
};
