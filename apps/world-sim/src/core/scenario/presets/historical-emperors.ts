import type { Scenario } from '../types';

/**
 * 历代帝王剧本：6 家代表性朝代/帝王。
 * 出生方位按地理直觉粗略安排：秦居西、汉居中、唐居中北、明居东南、清居东北、元居北。
 */
export const HISTORICAL_EMPERORS_SCENARIO: Scenario = {
  id: 'historical-emperors',
  name: '历代帝王',
  description: '秦汉唐宋明清等代表性政权同台，方位贴合史地直觉。',
  factions: [
    {
      factionName: '大秦',
      leader: '秦始皇',
      colorHex: '#5a4633',
      spawnProvinceIds: ['random:w'],
    },
    {
      factionName: '大汉',
      leader: '刘邦',
      colorHex: '#c0392b',
      spawnProvinceIds: ['random:center'],
    },
    {
      factionName: '大唐',
      leader: '李世民',
      colorHex: '#f5b942',
      spawnProvinceIds: ['random:n'],
    },
    {
      factionName: '大明',
      leader: '朱元璋',
      colorHex: '#2980b9',
      spawnProvinceIds: ['random:se'],
    },
    {
      factionName: '大清',
      leader: '康熙',
      colorHex: '#8e44ad',
      spawnProvinceIds: ['random:ne'],
    },
    {
      factionName: '大元',
      leader: '忽必烈',
      colorHex: '#16a085',
      spawnProvinceIds: ['random:nw'],
    },
  ],
};
