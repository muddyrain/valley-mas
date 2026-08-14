import { describe, expect, it } from 'vitest';
import { type Building, BuildingType } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import { resolveSettlementCapabilities } from './settlementCapabilities';

function completedBuilding(id: number, villageId: number, type: BuildingType): Building {
  return {
    id,
    villageId,
    type,
    x: 60 + id,
    z: 64,
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

describe('settlement public and defensive capabilities', () => {
  it('derives concrete abilities only from completed operational buildings', () => {
    const simulation = createWorldSimulation({
      seed: 'settlement-capabilities',
      initialHumans: 0,
      mapSize: 128,
    });
    const village = simulation.ensureVillageAt(64, 64, 45);
    const buildings = [
      completedBuilding(1, village.id, BuildingType.Barracks),
      completedBuilding(2, village.id, BuildingType.CouncilHall),
      completedBuilding(3, village.id, BuildingType.Wall),
      completedBuilding(4, village.id, BuildingType.Watchtower),
    ];
    buildings.forEach((building) => {
      simulation.state.buildings.push(building);
      village.buildingIds.push(building.id);
    });

    expect(resolveSettlementCapabilities(simulation.state, village)).toMatchObject({
      barracks: 1,
      councilHalls: 1,
      walls: 1,
      watchtowers: 1,
      guardTrainingSlots: 4,
      territoryReachBonus: 3,
      claimStrengthBonus: 8,
      captureBlockers: 1,
      watchRange: 14,
      watchDamage: 18,
    });

    buildings[1].health = 0;
    buildings[2].completed = false;
    buildings[3].health = 0;
    expect(resolveSettlementCapabilities(simulation.state, village)).toMatchObject({
      barracks: 1,
      councilHalls: 0,
      walls: 0,
      watchtowers: 0,
      guardTrainingSlots: 4,
      territoryReachBonus: 0,
      claimStrengthBonus: 0,
      captureBlockers: 0,
      watchRange: 0,
      watchDamage: 0,
    });
  });
});
