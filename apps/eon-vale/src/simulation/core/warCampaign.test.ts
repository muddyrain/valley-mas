import { describe, expect, it } from 'vitest';
import {
  type Building,
  BuildingType,
  DiplomacyState,
  EntityKind,
  Profession,
  VillageTier,
  type WorldState,
} from '@/shared/gameTypes';
import { formKingdoms, setDiplomacy } from '../kingdoms/kingdoms';
import { createWorldSimulation } from './worldSimulation';

function createRivalVillages() {
  const simulation = createWorldSimulation({ seed: 'guard-war', initialHumans: 0, mapSize: 128 });
  simulation.state.worldLaws.animalPredation = false;
  const firstIds = simulation.spawn(EntityKind.Human, 34, 64, 8);
  const secondIds = simulation.spawn(EntityKind.Human, 94, 64, 8);
  const firstVillage = simulation.ensureVillageAt(34, 64, firstIds.length);
  const secondVillage = simulation.ensureVillageAt(94, 64, secondIds.length);
  firstVillage.tier = VillageTier.Hamlet;
  secondVillage.tier = VillageTier.Hamlet;
  firstIds.forEach((entityId) => {
    simulation.state.entities.villageIds[entityId] = firstVillage.id;
  });
  secondIds.forEach((entityId) => {
    simulation.state.entities.villageIds[entityId] = secondVillage.id;
  });
  formKingdoms(simulation.state);
  setDiplomacy(simulation.state, 1, 2, DiplomacyState.War);
  return { simulation, firstIds, secondIds, firstVillage, secondVillage };
}

function makeGuard(state: WorldState, entityId: number, x: number, z: number): void {
  state.entities.professions[entityId] = Profession.Guard;
  state.entities.positionsX[entityId] = x;
  state.entities.positionsZ[entityId] = z;
  state.entities.health[entityId] = 1_000;
}

function addDefensiveBuilding(
  state: WorldState,
  villageId: number,
  type: BuildingType,
  x: number,
  z: number,
): Building {
  const building: Building = {
    id: state.buildings.length + 1,
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
  state.buildings.push(building);
  state.villages.find((village) => village.id === villageId)?.buildingIds.push(building.id);
  return building;
}

describe('guard war campaign', () => {
  it('makes opposing guards fight each other before harming civilians', () => {
    const { simulation, firstIds, secondIds } = createRivalVillages();
    const firstGuard = firstIds[0] ?? -1;
    const secondGuard = secondIds[0] ?? -1;
    makeGuard(simulation.state, firstGuard, 64, 64);
    makeGuard(simulation.state, secondGuard, 64.8, 64);
    const civilian = secondIds[1] ?? -1;
    simulation.state.entities.professions[civilian] = Profession.Forager;
    simulation.state.entities.health[civilian] = 1_000;
    simulation.state.entities.positionsX[civilian] = 64.4;
    simulation.state.entities.positionsZ[civilian] = 64.3;

    for (let tick = 0; tick < 120; tick += 1) simulation.step();

    const guardDamage =
      2_000 -
      (simulation.state.entities.health[firstGuard] ?? 0) -
      (simulation.state.entities.health[secondGuard] ?? 0);
    expect(guardDamage).toBeGreaterThan(0);
    expect(simulation.state.entities.health[civilian]).toBe(1_000);
  });

  it('captures a village after its defenders collapse while preserving settlement health', () => {
    const { simulation, firstIds, secondIds, firstVillage, secondVillage } = createRivalVillages();
    for (const entityId of firstIds.slice(0, 3)) {
      makeGuard(simulation.state, entityId, secondVillage.x, secondVillage.z);
    }
    for (const entityId of secondIds) {
      simulation.state.entities.professions[entityId] = Profession.Forager;
    }

    for (let tick = 0; tick < 600; tick += 1) simulation.step();

    expect(secondVillage.kingdomId).toBe(firstVillage.kingdomId);
    expect(secondVillage.health).toBeGreaterThanOrEqual(600);
    expect(simulation.state.kingdoms[0]?.villageIds).toContain(secondVillage.id);
    expect(simulation.state.events.some((event) => event.kind === 'conquest')).toBe(true);
  });

  it('requires attackers to breach an operational wall before capture can advance', () => {
    const { simulation, firstIds, secondIds, firstVillage, secondVillage } = createRivalVillages();
    for (const entityId of firstIds.slice(0, 3)) {
      makeGuard(simulation.state, entityId, secondVillage.x, secondVillage.z);
    }
    for (const entityId of secondIds) {
      simulation.state.entities.professions[entityId] = Profession.Forager;
    }
    const wall = addDefensiveBuilding(
      simulation.state,
      secondVillage.id,
      BuildingType.Wall,
      secondVillage.x,
      secondVillage.z,
    );
    const secondWall = addDefensiveBuilding(
      simulation.state,
      secondVillage.id,
      BuildingType.Wall,
      secondVillage.x + 1,
      secondVillage.z,
    );

    for (let tick = 0; tick < 80; tick += 1) simulation.step();

    expect(secondVillage.kingdomId).not.toBe(firstVillage.kingdomId);
    expect(secondVillage.captureProgress).toBe(0);
    expect(wall.health).toBeLessThan(100);

    for (let tick = 0; tick < 40; tick += 1) simulation.step();
    expect(wall.health).toBe(0);
    expect(secondWall.health).toBeLessThan(100);
    expect(secondVillage.captureProgress).toBe(0);

    for (let tick = 0; tick < 600; tick += 1) simulation.step();
    expect(secondWall.health).toBe(0);
    expect(secondVillage.kingdomId).toBe(firstVillage.kingdomId);
  });

  it('lets an operational watchtower damage incoming enemy guards and stops when destroyed', () => {
    const { simulation, firstIds, secondIds, secondVillage } = createRivalVillages();
    const attacker = firstIds[0] ?? -1;
    makeGuard(simulation.state, attacker, secondVillage.x - 8, secondVillage.z);
    for (const entityId of secondIds) {
      simulation.state.entities.professions[entityId] = Profession.Forager;
    }
    const tower = addDefensiveBuilding(
      simulation.state,
      secondVillage.id,
      BuildingType.Watchtower,
      secondVillage.x,
      secondVillage.z,
    );

    for (let tick = 0; tick < 24; tick += 1) simulation.step();
    expect(simulation.state.entities.health[attacker]).toBeLessThan(1_000);

    simulation.state.entities.health[attacker] = 1_000;
    tower.health = 0;
    for (let tick = 0; tick < 24; tick += 1) simulation.step();
    expect(simulation.state.entities.health[attacker]).toBe(1_000);
  });

  it('ends a fatigued war after five years and enforces a fifteen-year truce', () => {
    const { simulation } = createRivalVillages();
    simulation.step();
    simulation.step();
    const war = simulation.state.wars[0];
    expect(war).toBeDefined();
    if (!war) return;
    war.startedAtTick = simulation.state.tick - 3_600;
    war.capturedVillageIds.push(2);

    simulation.step();
    simulation.step();

    expect(simulation.state.kingdoms[0]?.relations[2]).toBe(DiplomacyState.Peace);
    expect(simulation.state.truces[0]?.untilTick).toBeGreaterThanOrEqual(
      simulation.state.tick + 10_799,
    );
    for (let tick = 0; tick < 200; tick += 1) simulation.step();
    expect(simulation.state.kingdoms[0]?.relations[2]).toBe(DiplomacyState.Peace);
  });
});
