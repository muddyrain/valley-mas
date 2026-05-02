import { TOY_ANIMAL_CLIMB_WORLD_LEVEL } from './levels/toyAnimalClimbWorld';
import type { ClimberLevelDefinition } from './types';

export const CLIMBER_LEVELS: ClimberLevelDefinition[] = [TOY_ANIMAL_CLIMB_WORLD_LEVEL];

export function getClimberLevelById(levelId: string): ClimberLevelDefinition | undefined {
  return CLIMBER_LEVELS.find((level) => level.id === levelId);
}
