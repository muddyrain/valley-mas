import { GRAND_CLIMB_WORLD_LEVEL } from './levels/grandClimbWorld';
import type { ClimberLevelDefinition } from './types';

export const CLIMBER_LEVELS: ClimberLevelDefinition[] = [GRAND_CLIMB_WORLD_LEVEL];

export function getClimberLevelById(levelId: string): ClimberLevelDefinition | undefined {
  return CLIMBER_LEVELS.find((level) => level.id === levelId);
}
