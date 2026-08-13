import { describe, expect, it } from 'vitest';
import {
  AgentState,
  BuildingType,
  GodPower,
  ResourceNodeKind,
  TerrainType,
  VillageTier,
} from '@/shared/gameTypes';
import { generateWorldMap, navigationCostForTerrain } from '../map/generateWorldMap';
import { editTerrain } from '../map/terrainEditing';
import { addResourceNode } from '../resources/resourceNodes';
import {
  applyConstructionWork,
  clearConstructionSite,
  deliverConstructionResources,
  evaluateVillageTier,
  startConstruction,
} from '../systems/economy';
import { applyGodPower, stepEnvironment } from '../systems/environment';
import { selectUtilityState } from '../systems/needs';
import { createWorldSimulation } from './worldSimulation';

describe('world generation', () => {
  it('creates a reproducible 128x128 world from a stable seed', () => {
    const first = generateWorldMap('evergreen');
    const second = generateWorldMap('evergreen');

    expect(first.size).toBe(128);
    expect(first.terrain).toEqual(second.terrain);
    expect(first.height).toEqual(second.height);
    expect(first.resourceWood).toEqual(second.resourceWood);
  });

  it.each([
    ['archipelago', 128],
    ['continent', 256],
    ['ocean', 384],
  ] as const)('creates a finite %s world at %i cells with an ocean boundary', (preset, size) => {
    const map = generateWorldMap(`preset-${preset}`, size, preset);

    expect(map.size).toBe(size);
    for (let index = 0; index < size; index += 1) {
      expect(map.terrain[index]).toBe(TerrainType.DeepOcean);
      expect(map.terrain[(size - 1) * size + index]).toBe(TerrainType.DeepOcean);
      expect(map.terrain[index * size]).toBe(TerrainType.DeepOcean);
      expect(map.terrain[index * size + size - 1]).toBe(TerrainType.DeepOcean);
    }
  });

  it('invalidates only the edited navigation chunk', () => {
    const map = generateWorldMap('chunks', 32);
    const before = map.navigation.chunkVersions.slice();

    const changedChunks = editTerrain(map, { kind: 'paint-water', cell: 9 * 32 + 9, radius: 1 });

    const changed = Array.from(map.navigation.chunkVersions).flatMap((version, index) =>
      version === before[index] ? [] : [index],
    );
    expect(changed).toEqual(changedChunks);
    expect(changed).toEqual([5]);
  });

  it('never lets a road make water or mountains passable', () => {
    expect(navigationCostForTerrain(TerrainType.ShallowOcean, true)).toBe(0);
    expect(navigationCostForTerrain(TerrainType.Mountain, true)).toBe(0);
    expect(navigationCostForTerrain(TerrainType.Grass, true)).toBe(1);
  });

  it('forms broad contiguous biomes instead of single-cell terrain noise', () => {
    const map = generateWorldMap('broad-biomes', 128, 'continent');
    let landEdges = 0;
    let biomeTransitions = 0;
    for (let z = 1; z < map.size - 1; z += 1) {
      for (let x = 1; x < map.size - 1; x += 1) {
        const cell = z * map.size + x;
        const right = cell + 1;
        const terrain = map.terrain[cell] as TerrainType;
        const neighbour = map.terrain[right] as TerrainType;
        if (terrain <= TerrainType.Beach || neighbour <= TerrainType.Beach) continue;
        landEdges += 1;
        if (terrain !== neighbour) biomeTransitions += 1;
      }
    }

    expect(biomeTransitions / Math.max(1, landEdges)).toBeLessThan(0.055);
  });
});

describe('resident utility decisions', () => {
  it('prioritises survival needs over routine work', () => {
    expect(
      selectUtilityState({ hunger: 930, energy: 800, danger: 0, hasWork: true, isGuard: false }),
    ).toBe(AgentState.FindFood);
    expect(
      selectUtilityState({ hunger: 100, energy: 90, danger: 0, hasWork: true, isGuard: false }),
    ).toBe(AgentState.Rest);
    expect(
      selectUtilityState({ hunger: 100, energy: 900, danger: 1, hasWork: true, isGuard: false }),
    ).toBe(AgentState.Flee);
  });
});

describe('village economy', () => {
  it('locks cost once, clears real nodes, receives batches, then advances visible stages', () => {
    const simulation = createWorldSimulation({ seed: 'builders', initialHumans: 24 });
    const village = simulation.ensureVillageAt(64, 64, 12);
    village.resources.wood = 100;
    village.resources.stone = 100;
    const before = { ...village.resources };
    const blockingTree = addResourceNode(simulation.state.resourceNodes, {
      kind: ResourceNodeKind.Tree,
      x: 65.5,
      z: 64.5,
      amount: 4,
    });

    const building = startConstruction(simulation.state, village, BuildingType.Home, 65, 64);

    expect(building).not.toBeNull();
    if (!building) throw new Error('测试建筑未创建');
    expect(village.resources.wood).toBeLessThan(before.wood);
    const afterStart = { ...village.resources };
    expect(building?.constructionPhase).toBe('clearing');
    expect(building?.clearNodeIds).toContain(blockingTree);
    expect(clearConstructionSite(simulation.state, building)).toBe(true);
    expect(simulation.state.resourceNodes.active[blockingTree]).toBe(0);
    expect(building?.constructionPhase).toBe('delivery');
    while (building.constructionPhase === 'delivery') {
      deliverConstructionResources(building, 4, 2);
    }
    expect(building?.constructionPhase).toBe('building');
    applyConstructionWork(simulation.state, building, building.requiredProgress);
    expect(village.resources.wood).toBe(afterStart.wood + 4);
    expect(village.resources.stone).toBe(afterStart.stone);
    expect(building?.stage).toBe(2);
    expect(building?.completed).toBe(true);
  });

  it('upgrades villages only when population and buildings qualify', () => {
    expect(evaluateVillageTier(8, 1)).toBe(VillageTier.Camp);
    expect(evaluateVillageTier(14, 3)).toBe(VillageTier.Hamlet);
    expect(evaluateVillageTier(28, 7)).toBe(VillageTier.Town);
    expect(evaluateVillageTier(50, 12)).toBe(VillageTier.CityState);
  });

  it('allows a mine only near a finite metal vein', () => {
    const simulation = createWorldSimulation({
      seed: 'vein-gate',
      initialHumans: 0,
      mapSize: 128,
      preset: 'ocean',
    });
    const village = simulation.ensureVillageAt(64, 64, 8);
    village.resources.wood = 100;
    village.resources.stone = 100;
    expect(startConstruction(simulation.state, village, BuildingType.Mine, 66, 64)).toBeNull();

    addResourceNode(simulation.state.resourceNodes, {
      kind: ResourceNodeKind.Metal,
      x: 64.5,
      z: 64.5,
      amount: 40,
    });
    expect(startConstruction(simulation.state, village, BuildingType.Mine, 66, 64)).not.toBeNull();
  });

  it('never creates resources from nothing or allows negative stockpiles', () => {
    const simulation = createWorldSimulation({ seed: 'ledger', initialHumans: 72 });
    for (let tick = 0; tick < 1_200; tick += 1) simulation.step();

    for (const village of simulation.state.villages) {
      expect(village.resources.food).toBeGreaterThanOrEqual(0);
      expect(village.resources.wood).toBeGreaterThanOrEqual(0);
      expect(village.resources.stone).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('environment chains', () => {
  it('rain suppresses fire and accelerates crops inside its radius', () => {
    const simulation = createWorldSimulation({ seed: 'rain', initialHumans: 12 });
    const size = simulation.state.map.size;
    const cell = Math.floor(size / 2) * size + Math.floor(size / 2);
    simulation.state.map.terrain[cell] = TerrainType.Grass;
    simulation.state.map.fire[cell] = 220;
    simulation.state.map.crops[cell] = 20;

    applyGodPower(simulation.state, GodPower.Rain, cell, 4);
    stepEnvironment(simulation.state);

    expect(simulation.state.map.fire[cell]).toBeLessThan(220);
    expect(simulation.state.map.crops[cell]).toBeGreaterThan(20);
  });

  it('fire and plague never propagate across ocean cells', () => {
    const simulation = createWorldSimulation({ seed: 'isolation', initialHumans: 12 });
    const size = simulation.state.map.size;
    const center = 20 * size + 20;
    simulation.state.map.fire[center] = 255;
    simulation.state.map.plague[center] = 255;
    for (const neighbour of [center - 1, center + 1, center - size, center + size]) {
      simulation.state.map.terrain[neighbour] = TerrainType.Ocean;
    }

    for (let tick = 0; tick < 40; tick += 1) stepEnvironment(simulation.state);

    for (const neighbour of [center - 1, center + 1, center - size, center + size]) {
      expect(simulation.state.map.fire[neighbour]).toBe(0);
      expect(simulation.state.map.plague[neighbour]).toBe(0);
    }
  });

  it('growth and destructive powers mutate independent resource nodes', () => {
    const simulation = createWorldSimulation({ seed: 'living-nodes', initialHumans: 0 });
    const size = simulation.state.map.size;
    const cell = 24 * size + 24;
    simulation.state.map.terrain[cell] = TerrainType.Forest;
    for (const nodeId of simulation.state.resourceNodes.dirtyNodeIds) {
      simulation.state.resourceNodes.active[nodeId] = 0;
    }
    const before = simulation.state.resourceNodes.count;

    applyGodPower(simulation.state, GodPower.Growth, cell, 0);
    expect(simulation.state.resourceNodes.count).toBeGreaterThan(before);
    const grown = simulation.state.resourceNodes.count - 1;
    expect(simulation.state.resourceNodes.kind[grown]).toBe(ResourceNodeKind.Tree);

    applyGodPower(simulation.state, GodPower.Meteor, cell, 1);
    expect(simulation.state.resourceNodes.active[grown]).toBe(0);
  });
});
