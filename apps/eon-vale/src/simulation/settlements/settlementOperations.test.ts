import { beforeEach, describe, expect, it } from 'vitest';
import { type Building, BuildingType, EntityKind, Profession } from '@/shared/gameTypes';
import { createWorldSimulation } from '../core/worldSimulation';
import {
  advanceVillageGuardTraining,
  assignVillageHomesAndWorkplaces,
  decayOutdoorStockpiles,
  recalculateVillageOperations,
  selectNextBuildingType,
} from './settlementOperations';

function completedBuilding(id: number, villageId: number, type: BuildingType): Building {
  return {
    id,
    villageId,
    type,
    x: 32 + id,
    z: 32,
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

describe('functional settlement operations', () => {
  const simulation = createWorldSimulation({ seed: 'settlement-operations', initialHumans: 0 });
  const village = simulation.ensureVillageAt(32, 32, 0);

  beforeEach(() => {
    simulation.state.buildings.length = 0;
    village.buildingIds.length = 0;
    village.resources.food = 20;
    village.resources.wood = 20;
    village.outdoorStockpile.food = 0;
    village.outdoorStockpile.wood = 0;
    village.outdoorSinceTicks.food = 0;
    village.outdoorSinceTicks.wood = 0;
    simulation.state.tick = 0;
    simulation.state.map.fire.fill(0);
  });

  it('derives housing and category capacity only from operational buildings', () => {
    const home = completedBuilding(1, village.id, BuildingType.Home);
    const storage = completedBuilding(2, village.id, BuildingType.Storage);
    simulation.state.buildings.push(home, storage);
    village.buildingIds.push(1, 2);

    recalculateVillageOperations(simulation.state, village);
    expect(village.housingCapacity).toBe(13);
    expect(village.storageCapacityByKind.food).toBe(160);

    home.health = 0;
    storage.health = 0;
    recalculateVillageOperations(simulation.state, village);
    expect(village.housingCapacity).toBe(5);
    expect(village.storageCapacityByKind.food).toBe(40);
  });

  it('keeps a family together in one home and enforces workplace slots', () => {
    const [first, second, child] = simulation.spawn(EntityKind.Human, 32, 32, 3);
    for (const id of [first, second, child]) {
      simulation.state.entities.villageIds[id] = village.id;
      simulation.state.entities.familyIds[id] = 4;
      simulation.state.entities.professions[id] = Profession.Farmer;
    }
    simulation.state.entities.age[child] = 8;
    const home = completedBuilding(1, village.id, BuildingType.Home);
    const farm = completedBuilding(2, village.id, BuildingType.Farm);
    simulation.state.buildings.push(home, farm);
    village.buildingIds.push(1, 2);

    assignVillageHomesAndWorkplaces(simulation.state, village);

    expect(
      [first, second, child].map((id) => simulation.state.entities.homeBuildingIds[id]),
    ).toEqual([1, 1, 1]);
    expect(farm.assignedWorkerIds).toHaveLength(3);
    expect(farm.workSlots).toBe(3);
  });

  it('assigns guards to operational barracks and advances visible training', () => {
    const guards = simulation.spawn(EntityKind.Human, 36, 32, 5);
    for (const entityId of guards) {
      simulation.state.entities.villageIds[entityId] = village.id;
      simulation.state.entities.professions[entityId] = Profession.Guard;
      simulation.state.entities.positionsX[entityId] = 36;
      simulation.state.entities.positionsZ[entityId] = 32;
    }
    const barracks = completedBuilding(1, village.id, BuildingType.Barracks);
    barracks.x = 36;
    simulation.state.buildings.push(barracks);
    village.buildingIds.push(barracks.id);

    assignVillageHomesAndWorkplaces(simulation.state, village);
    simulation.state.tick = 120;

    expect(barracks.workSlots).toBe(4);
    expect(barracks.assignedWorkerIds).toHaveLength(4);
    expect(advanceVillageGuardTraining(simulation.state, village)).toBe(4);
    expect(
      barracks.assignedWorkerIds.every(
        (entityId) => (simulation.state.entities.experience[entityId] ?? 0) > 0,
      ),
    ).toBe(true);

    barracks.health = 0;
    assignVillageHomesAndWorkplaces(simulation.state, village);
    simulation.state.tick = 240;
    expect(barracks.workSlots).toBe(0);
    expect(advanceVillageGuardTraining(simulation.state, village)).toBe(0);
  });

  it('moves overflow into visible stockpiles and decays exposed food and wood', () => {
    village.resources.food = 60;
    village.resources.wood = 70;
    recalculateVillageOperations(simulation.state, village);
    expect(village.resources.food).toBe(40);
    expect(village.outdoorStockpile.food).toBe(20);
    expect(village.outdoorStockpile.wood).toBe(30);

    village.outdoorSinceTicks.food = 1;
    village.outdoorSinceTicks.wood = 1;
    simulation.state.tick = 1_440;
    decayOutdoorStockpiles(simulation.state, village);
    expect(village.outdoorStockpile.food).toBe(10);
    expect(village.outdoorStockpile.wood).toBe(27);
  });

  it('burns exposed food and wood and reports the losses', () => {
    village.outdoorStockpile.food = 20;
    village.outdoorStockpile.wood = 12;
    const cell = Math.floor(village.z) * simulation.state.map.size + Math.floor(village.x);
    simulation.state.map.fire[cell] = 200;

    expect(decayOutdoorStockpiles(simulation.state, village)).toMatchObject({ food: 5, wood: 3 });
    expect(village.outdoorStockpile.food).toBe(15);
    expect(village.outdoorStockpile.wood).toBe(9);
  });

  it('uses need and player priority instead of a blocking linear sequence', () => {
    village.population = 12;
    village.constructionPriority = 'housing';
    expect(selectNextBuildingType(simulation.state, village)).toMatchObject({
      type: BuildingType.Home,
      decision: '玩家优先住房',
    });

    village.resources.food = 0;
    expect(selectNextBuildingType(simulation.state, village)).toMatchObject({
      type: BuildingType.Farm,
      overrideReason: '断粮风险覆盖玩家优先级',
    });
  });

  it('does not build endless duplicate barracks for a persistent defense priority', () => {
    village.population = 45;
    village.resources.food = 200;
    village.constructionPriority = 'defense';
    for (const type of [BuildingType.Barracks, BuildingType.Wall, BuildingType.Watchtower]) {
      const building = completedBuilding(simulation.state.buildings.length + 1, village.id, type);
      simulation.state.buildings.push(building);
      village.buildingIds.push(building.id);
    }

    expect(selectNextBuildingType(simulation.state, village)).toBeNull();
  });

  it('stops automatic expansion when a mature settlement has no active shortage', () => {
    village.population = 12;
    village.carryingCapacity = 15;
    village.housingCapacity = 13;
    village.resources.food = 100;
    village.constructionPriority = 'automatic';
    const types = [
      BuildingType.TownCenter,
      BuildingType.Home,
      BuildingType.Farm,
      BuildingType.Farm,
      BuildingType.Storage,
      BuildingType.LoggingCamp,
      BuildingType.Mine,
      BuildingType.Workshop,
    ];
    types.forEach((type, index) => {
      const building = completedBuilding(index + 1, village.id, type);
      simulation.state.buildings.push(building);
      village.buildingIds.push(building.id);
    });

    expect(selectNextBuildingType(simulation.state, village)).toBeNull();
  });

  it('adds one home before occupancy exceeds the healthy ceiling', () => {
    village.population = 75;
    village.carryingCapacity = 87;
    village.housingCapacity = 93;
    village.resources.food = 100;
    village.constructionPriority = 'automatic';
    const center = completedBuilding(1, village.id, BuildingType.TownCenter);
    simulation.state.buildings.push(center);
    village.buildingIds.push(center.id);

    expect(selectNextBuildingType(simulation.state, village)).toMatchObject({
      type: BuildingType.Home,
      decision: '补足居民住房',
    });
  });
});
