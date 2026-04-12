import { TOGETHER_SKY_ASCENT_LEVEL } from './levels/togetherSkyAscent';
import type { ClimberLevelDefinition } from './types';

export const CLIMBER_LEVELS: ClimberLevelDefinition[] = [TOGETHER_SKY_ASCENT_LEVEL];

export function getClimberLevelById(levelId: string): ClimberLevelDefinition | undefined {
  return CLIMBER_LEVELS.find((level) => level.id === levelId);
}
