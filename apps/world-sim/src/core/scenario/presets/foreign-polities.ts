import type { Scenario } from '../types';
import { RANDOM_SCENARIO } from './random';

/**
 * 国外政体剧本：复用随机剧本工厂，但固定只从国外政体池抽取势力。
 */
export const FOREIGN_POLITIES_SCENARIO: Scenario = {
  id: 'foreign-polities',
  name: '国外政体',
  description: '从国外历史政体中随机抽 8 家势力，政体与领袖成组出现。',
  factions: [],
  preferredMapMode: 'random',
  mapSeedSuffix: '-foreign',
  factoryOptions: { includeChinese: false, includeForeign: true },
  factionsFactory: RANDOM_SCENARIO.factionsFactory,
};
