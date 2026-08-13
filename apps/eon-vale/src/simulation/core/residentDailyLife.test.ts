import { describe, expect, it } from 'vitest';
import {
  AgentState,
  type Building,
  BuildingType,
  EntityKind,
  Profession,
} from '@/shared/gameTypes';
import { assignVillageHomesAndWorkplaces } from '../settlements/settlementOperations';
import { createWorldSimulation } from './worldSimulation';

function building(
  id: number,
  villageId: number,
  type: BuildingType,
  x: number,
  z: number,
): Building {
  return {
    id,
    villageId,
    type,
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

describe('resident daily life', () => {
  it('walks to storage, carries a normal meal home, then eats it', () => {
    const simulation = createWorldSimulation({ seed: 'daily-meal', initialHumans: 0 });
    const village = simulation.ensureVillageAt(42, 42, 1);
    const resident = simulation.spawn(EntityKind.Human, 46, 42)[0] as number;
    const residentX = Math.floor(simulation.state.entities.positionsX[resident] ?? 0);
    const residentZ = Math.floor(simulation.state.entities.positionsZ[resident] ?? 0);
    village.x = residentX;
    village.z = residentZ;
    simulation.state.entities.villageIds[resident] = village.id;
    simulation.state.entities.professions[resident] = Profession.Hauler;
    simulation.state.entities.hunger[resident] = 700;
    simulation.state.entities.energy[resident] = 1_000;
    village.resources.food = 10;
    const home = building(1, village.id, BuildingType.Home, residentX, residentZ);
    const storage = building(2, village.id, BuildingType.Storage, residentX, residentZ);
    simulation.state.buildings.push(home, storage);
    village.buildingIds.push(home.id, storage.id);
    assignVillageHomesAndWorkplaces(simulation.state, village);
    village.outdoorStockpile.food = 0;
    village.resources.food = 10;

    expect(village.resources.food).toBe(10);
    for (let tick = 0; tick < 5 && !simulation.state.entities.tasks[resident]; tick += 1)
      simulation.step();
    expect(simulation.state.entities.tasks[resident]).toMatchObject({
      type: 'eat',
      reason: 'hunger',
    });

    for (let tick = 0; tick < 600 && simulation.state.entities.hunger[resident] >= 200; tick += 1) {
      simulation.step();
    }

    expect(village.resources.food).toBe(9);
    expect(simulation.state.entities.hunger[resident]).toBeLessThan(300);
    expect(simulation.state.entities.carriedResources[resident]).toBe(0);
    expect(
      Math.hypot(
        (simulation.state.entities.positionsX[resident] ?? 0) - home.x,
        (simulation.state.entities.positionsZ[resident] ?? 0) - home.z,
      ),
    ).toBeLessThan(2);
  });

  it('sleeps at the assigned home to 850 energy and uses half recovery when homeless', () => {
    const housed = createWorldSimulation({ seed: 'daily-sleep-home', initialHumans: 0 });
    const village = housed.ensureVillageAt(40, 40, 1);
    const resident = housed.spawn(EntityKind.Human, 42, 40)[0] as number;
    const residentX = Math.floor(housed.state.entities.positionsX[resident] ?? 0);
    const residentZ = Math.floor(housed.state.entities.positionsZ[resident] ?? 0);
    village.x = residentX;
    village.z = residentZ;
    housed.state.entities.villageIds[resident] = village.id;
    housed.state.entities.energy[resident] = 100;
    housed.state.entities.hunger[resident] = 0;
    const home = building(1, village.id, BuildingType.Home, residentX, residentZ);
    housed.state.buildings.push(home);
    village.buildingIds.push(home.id);
    assignVillageHomesAndWorkplaces(housed.state, village);

    for (let tick = 0; tick < 500 && housed.state.entities.energy[resident] < 850; tick += 1) {
      housed.step();
    }
    expect(housed.state.entities.energy[resident]).toBeGreaterThanOrEqual(850);
    expect(housed.state.entities.states[resident]).not.toBe(AgentState.Rest);

    const homeless = createWorldSimulation({ seed: 'daily-sleep-outside', initialHumans: 0 });
    const camp = homeless.ensureVillageAt(40, 40, 1);
    const camper = homeless.spawn(EntityKind.Human, 40, 40)[0] as number;
    camp.x = Math.floor(homeless.state.entities.positionsX[camper] ?? 0);
    camp.z = Math.floor(homeless.state.entities.positionsZ[camper] ?? 0);
    homeless.state.entities.villageIds[camper] = camp.id;
    homeless.state.entities.energy[camper] = 100;
    homeless.state.entities.hunger[camper] = 0;
    assignVillageHomesAndWorkplaces(homeless.state, camp);
    for (let tick = 0; tick < 80; tick += 1) homeless.step();

    expect(homeless.state.entities.homeBuildingIds[camper]).toBe(0);
    expect(homeless.state.entities.energy[camper]).toBeLessThan(300);
  });
});
