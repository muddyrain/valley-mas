import { describe, expect, it } from 'vitest';
import {
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

describe('guard war campaign', () => {
  it('makes opposing guards fight each other before harming civilians', () => {
    const { simulation, firstIds, secondIds } = createRivalVillages();
    const firstGuard = firstIds[0] ?? -1;
    const secondGuard = secondIds[0] ?? -1;
    makeGuard(simulation.state, firstGuard, 64, 64);
    makeGuard(simulation.state, secondGuard, 64.8, 64);
    const civilian = secondIds[1] ?? -1;
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
