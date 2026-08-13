import { describe, expect, it } from 'vitest';
import { AgentState, EntityKind, ResourceNodeKind, ResourceNodeStage } from '@/shared/gameTypes';
import { setCellCost } from '../navigation/grid';
import { findResourceNodesInRadius } from '../resources/resourceNodes';
import { createWorldSimulation } from './worldSimulation';

describe('animal behaviour', () => {
  it('starts all six terrestrial species and makes prey flee nearby predators', () => {
    const simulation = createWorldSimulation({ seed: 'wildlife', initialHumans: 0 });
    const kinds = Array.from(
      simulation.state.entities.kind.slice(0, simulation.state.entities.count),
    );
    expect(new Set(kinds)).toEqual(
      new Set([
        EntityKind.Chicken,
        EntityKind.Sheep,
        EntityKind.Cow,
        EntityKind.Deer,
        EntityKind.Wolf,
        EntityKind.Bear,
      ]),
    );

    const sheepId = simulation.spawn(EntityKind.Sheep, 64, 64)[0] as number;
    const wolfId = simulation.spawn(EntityKind.Wolf, 64, 64)[0] as number;
    simulation.state.entities.positionsX[wolfId] =
      simulation.state.entities.positionsX[sheepId] + 1;
    simulation.state.entities.positionsZ[wolfId] =
      simulation.state.entities.positionsZ[sheepId] + 1;
    const sheepBefore = [
      simulation.state.entities.positionsX[sheepId],
      simulation.state.entities.positionsZ[sheepId],
    ];

    for (let tick = 0; tick < 30; tick += 1) simulation.step();

    expect(simulation.state.entities.states[sheepId]).toBe(AgentState.Flee);
    expect([
      simulation.state.entities.positionsX[sheepId],
      simulation.state.entities.positionsZ[sheepId],
    ]).not.toEqual(sheepBefore);
  });

  it('keeps a blank-ocean world empty until the player creates land and life', () => {
    const simulation = createWorldSimulation({
      seed: 'blank-ocean',
      initialHumans: 72,
      preset: 'ocean',
    });

    expect(simulation.state.entities.count).toBe(0);
  });

  it('routes a pursuing land animal around an impassable ridge', () => {
    const simulation = createWorldSimulation({ seed: 'animal-ridge', initialHumans: 0 });
    const sheepId = simulation.spawn(EntityKind.Sheep, 60.5, 64.5)[0] as number;
    const wolfId = simulation.spawn(EntityKind.Wolf, 68.5, 64.5)[0] as number;
    simulation.state.entities.hunger[wolfId] = 900;
    for (let z = 59; z <= 69; z += 1) setCellCost(simulation.state.map.navigation, 64, z, 0);

    for (let tick = 0; tick < 180; tick += 1) {
      simulation.step();
      const wolfCell =
        Math.floor(simulation.state.entities.positionsZ[wolfId] ?? 0) * simulation.state.map.size +
        Math.floor(simulation.state.entities.positionsX[wolfId] ?? 0);
      expect(simulation.state.map.navigation.cost[wolfCell]).toBeGreaterThan(0);
    }

    expect(simulation.state.entities.active[sheepId]).toBe(1);
  });

  it.each(
    Array.from({ length: 10 }, (_, index) => `movement-seed-${index}`),
  )('keeps land life on traversable cells and outside mature trunks for %s', (seed) => {
    const simulation = createWorldSimulation({ seed, initialHumans: 24, mapSize: 128 });
    for (let tick = 0; tick < 120; tick += 1) simulation.step();

    for (let entityId = 0; entityId < simulation.state.entities.count; entityId += 1) {
      if (!simulation.state.entities.active[entityId]) continue;
      const kind = simulation.state.entities.kind[entityId] as EntityKind;
      if (kind === EntityKind.Fish) continue;
      const x = simulation.state.entities.positionsX[entityId] ?? 0;
      const z = simulation.state.entities.positionsZ[entityId] ?? 0;
      const cell = Math.floor(z) * simulation.state.map.size + Math.floor(x);
      expect(simulation.state.map.navigation.cost[cell]).toBeGreaterThan(0);
      const overlapsTree = findResourceNodesInRadius(
        simulation.state.resourceNodes,
        x,
        z,
        0.219,
      ).some(
        (nodeId) =>
          simulation.state.resourceNodes.active[nodeId] === 1 &&
          simulation.state.resourceNodes.kind[nodeId] === ResourceNodeKind.Tree &&
          simulation.state.resourceNodes.stage[nodeId] === ResourceNodeStage.Mature,
      );
      expect(overlapsTree).toBe(false);
    }
  });
});
