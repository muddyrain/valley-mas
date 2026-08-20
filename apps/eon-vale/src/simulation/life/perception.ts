import { NaturalResourceKind, type NaturalResourceStore } from '../resources/naturalResources';
import type { LifePopulationFacts } from './lifeFacts';

function cellDistance(size: number, left: number, right: number): number {
  const leftX = left % size;
  const leftZ = Math.floor(left / size);
  const rightX = right % size;
  const rightZ = Math.floor(right / size);
  return Math.hypot(leftX - rightX, leftZ - rightZ);
}

export function updateLifePerceptions(
  population: LifePopulationFacts,
  resources: NaturalResourceStore,
  worldSize: number,
  tick: number,
): void {
  for (const human of population.life) {
    if (!human.active) continue;
    let nearestFoodResourceId: number | null = null;
    let nearestFoodDistance = Number.POSITIVE_INFINITY;
    for (let resourceId = 0; resourceId < resources.count; resourceId += 1) {
      if (
        !resources.active[resourceId] ||
        resources.kind[resourceId] !== NaturalResourceKind.WildFood ||
        (resources.amount[resourceId] ?? 0) <= 0
      ) {
        continue;
      }
      const distance = cellDistance(
        worldSize,
        human.cell,
        resources.cell[resourceId] ?? human.cell,
      );
      if (
        distance < nearestFoodDistance ||
        (distance === nearestFoodDistance &&
          (nearestFoodResourceId === null || resourceId < nearestFoodResourceId))
      ) {
        nearestFoodDistance = distance;
        nearestFoodResourceId = resourceId;
      }
    }
    human.perception = {
      observedAtTick: tick,
      nearestFoodResourceId,
      nearestFoodDistance:
        nearestFoodResourceId === null ? null : Math.round(nearestFoodDistance * 1_000) / 1_000,
    };
  }
}
