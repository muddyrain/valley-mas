import { TOGETHER_SKY_ASCENT_LEVEL } from './levels/togetherSkyAscent';
import { TOY_BLOCK_TOWER_LEVEL } from './levels/toyBlockTower';
import type { ClimberLevelDefinition } from './types';

export const CLIMBER_LEVELS: ClimberLevelDefinition[] = [
  TOY_BLOCK_TOWER_LEVEL,
  TOGETHER_SKY_ASCENT_LEVEL,
];

export function getClimberLevelById(levelId: string): ClimberLevelDefinition | undefined {
  return CLIMBER_LEVELS.find((level) => level.id === levelId);
}
