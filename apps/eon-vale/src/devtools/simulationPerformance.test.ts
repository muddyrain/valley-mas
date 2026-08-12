import { describe, expect, it } from 'vitest';
import {
  AgentState,
  DiplomacyState,
  EntityKind,
  GodPower,
  Profession,
  VillageTier,
} from '@/shared/gameTypes';
import { createWorldSimulation } from '@/simulation/core/worldSimulation';
import { formKingdoms, setDiplomacy } from '@/simulation/kingdoms/kingdoms';
import { editTerrain } from '@/simulation/map/terrainEditing';
import { applyGodPower } from '@/simulation/systems/environment';

function timeScenario(name: string, run: () => void): number {
  const startedAt = performance.now();
  run();
  const elapsedMs = performance.now() - startedAt;
  console.info(JSON.stringify({ scenario: name, elapsedMs: Number(elapsedMs.toFixed(2)) }));
  return elapsedMs;
}

describe('simulation performance regressions', () => {
  it('keeps a 384 world with 1000 residents and dense nodes under the tick budget', () => {
    const simulation = createWorldSimulation({
      seed: 'dense-complete-world',
      initialHumans: 1_000,
      mapSize: 384,
      preset: 'continent',
    });
    expect(simulation.state.resourceNodes.count).toBeGreaterThan(25_000);
    const elapsedMs = timeScenario('384-world-1000-residents-30000-nodes', () => {
      for (let tick = 0; tick < 300; tick += 1) simulation.step();
    });
    const averageTickMs = elapsedMs / 300;
    console.info(JSON.stringify({ averageTickMs: Number(averageTickMs.toFixed(3)) }));
    expect(averageTickMs).toBeLessThan(8);
  });

  it('keeps 500 residents simulated while a crowd flees a disaster', () => {
    const simulation = createWorldSimulation({ seed: 'mass-evacuation', initialHumans: 500 });
    const size = simulation.state.map.size;
    const center = Math.floor(size * 0.5) * size + Math.floor(size * 0.3);
    applyGodPower(simulation.state, GodPower.Fire, center, 18);
    const elapsedMs = timeScenario('500-resident-fire-evacuation', () => {
      for (let tick = 0; tick < 600; tick += 1) simulation.step();
    });
    const fleeing = Array.from(simulation.state.entities.states.slice(0, 500)).filter(
      (state) => state === AgentState.Flee,
    ).length;

    const residents = Array.from(
      simulation.state.entities.kind.slice(0, simulation.state.entities.count),
    ).filter((kind) => kind === EntityKind.Human).length;
    expect(residents).toBe(500);
    expect(fleeing).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(15_000);
  });

  it('moves two armies through shared flow fields and resolves guard combat first', () => {
    const simulation = createWorldSimulation({ seed: 'field-battle', initialHumans: 240 });
    const first = simulation.ensureVillageAt(40, 64, 120);
    const second = simulation.ensureVillageAt(88, 64, 120);
    first.tier = VillageTier.Hamlet;
    second.tier = VillageTier.Hamlet;
    for (let entityId = 0; entityId < 240; entityId += 1) {
      simulation.state.entities.villageIds[entityId] = entityId < 120 ? first.id : second.id;
      simulation.state.entities.professions[entityId] = Profession.Guard;
    }
    formKingdoms(simulation.state);
    setDiplomacy(simulation.state, 1, 2, DiplomacyState.War);
    const guardHealthBefore = Array.from(simulation.state.entities.health.slice(0, 240)).reduce(
      (sum, health) => sum + health,
      0,
    );
    const elapsedMs = timeScenario('two-kingdom-field-battle', () => {
      for (let tick = 0; tick < 1_200; tick += 1) simulation.step();
    });

    const guardHealthAfter = Array.from(simulation.state.entities.health.slice(0, 240)).reduce(
      (sum, health) => sum + health,
      0,
    );
    expect(guardHealthAfter).toBeLessThan(guardHealthBefore);
    expect(second.health).toBeGreaterThanOrEqual(650);
    expect(elapsedMs).toBeLessThan(15_000);
  });

  it('updates many terrain chunks without rebuilding navigation globally', () => {
    const simulation = createWorldSimulation({ seed: 'terrain-storm', initialHumans: 100 });
    const size = simulation.state.map.size;
    const before = simulation.state.map.navigation.chunkVersions.slice();
    const elapsedMs = timeScenario('100-local-terrain-edits', () => {
      for (let index = 0; index < 100; index += 1) {
        editTerrain(simulation.state.map, {
          kind: index % 2 ? 'paint-forest' : 'paint-land',
          cell: (8 + (index % 14) * 8) * size + 8 + ((index * 3) % 14) * 8,
          radius: 2,
        });
      }
    });
    const changedChunks = Array.from(simulation.state.map.navigation.chunkVersions).filter(
      (version, index) => version !== before[index],
    ).length;

    expect(changedChunks).toBeGreaterThan(10);
    expect(changedChunks).toBeLessThan(256);
    expect(elapsedMs).toBeLessThan(2_000);
  });

  it('advances the equivalent of 8x simulation without dropping entities', () => {
    const simulation = createWorldSimulation({ seed: 'eight-times', initialHumans: 500 });
    const elapsedMs = timeScenario('500-residents-eight-times', () => {
      for (let frame = 0; frame < 200; frame += 1) {
        for (let speedStep = 0; speedStep < 8; speedStep += 1) simulation.step();
      }
    });

    expect(simulation.state.tick).toBe(1_600);
    expect(simulation.state.entities.count).toBeGreaterThanOrEqual(500);
    expect(elapsedMs).toBeLessThan(20_000);
  });
});
