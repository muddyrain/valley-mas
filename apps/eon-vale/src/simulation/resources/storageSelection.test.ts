import { describe, expect, it } from 'vitest';
import { type Building, BuildingType, EntityKind } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import { selectReachableStorage } from './storageSelection';

function storage(id: number, villageId: number, x: number, z: number): Building {
  return {
    id,
    villageId,
    type: BuildingType.Storage,
    x,
    z,
    stage: 2,
    progress: 100,
    requiredProgress: 100,
    health: 100,
    completed: true,
    constructionPhase: 'complete',
    reservedWood: 0,
    reservedStone: 0,
    deliveredWood: 0,
    deliveredStone: 0,
    inTransitWood: 0,
    inTransitStone: 0,
    clearNodeIds: [],
    assignedWorkerIds: [],
    workSlots: 0,
  };
}

describe('reachable storage selection', () => {
  it('chooses the lowest navigation cost instead of the first built storage', () => {
    const simulation = createWorldSimulation({ seed: 'nearest-storage', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 1);
    const resident = simulation.spawn(EntityKind.Human, village.x, village.z)[0] as number;
    const residentX = simulation.state.entities.positionsX[resident] ?? village.x;
    const residentZ = simulation.state.entities.positionsZ[resident] ?? village.z;
    const far = storage(1, village.id, residentX + 18, residentZ);
    const near = storage(2, village.id, residentX + 2, residentZ);
    simulation.state.buildings.push(far, near);
    village.buildingIds.push(far.id, near.id);
    const fromCell = Math.floor(residentZ) * simulation.state.map.size + Math.floor(residentX);

    expect(selectReachableStorage(simulation.state, village.id, fromCell)?.building.id).toBe(
      near.id,
    );
  });

  it('ignores destroyed and unreachable storage', () => {
    const simulation = createWorldSimulation({ seed: 'reachable-storage', initialHumans: 0 });
    const village = simulation.ensureVillageAt(64, 64, 1);
    const destroyed = storage(1, village.id, 64, 64);
    destroyed.health = 0;
    simulation.state.buildings.push(destroyed);
    village.buildingIds.push(destroyed.id);

    expect(
      selectReachableStorage(simulation.state, village.id, 64 * simulation.state.map.size + 64),
    ).toBeNull();
  });
});
