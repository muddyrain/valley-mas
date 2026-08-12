import { describe, expect, it } from 'vitest';
import { ResourceNodeKind, ResourceNodeStage, TerrainType } from '@/shared/gameTypes';
import { generateWorldMap } from '../map/generateWorldMap';
import {
  addResourceNode,
  advanceResourceRegrowth,
  createResourceNodeStore,
  findNearestAvailableResourceNode,
  generateResourceNodes,
  harvestResourceNode,
  reserveResourceNode,
  resourceNodeAvoidance,
} from './resourceNodes';

describe('independent resource nodes', () => {
  it('generates deterministic, area-scaled nodes for a finite complete world', () => {
    const map = generateWorldMap('node-generation', 384, 'continent');
    const first = generateResourceNodes(map, 'node-generation');
    const second = generateResourceNodes(map, 'node-generation');

    expect(first.count).toBeGreaterThan(25_000);
    expect(first.count).toBeLessThan(45_000);
    expect(second.count).toBe(first.count);
    expect(second.kind.slice(0, first.count)).toEqual(first.kind.slice(0, first.count));
    expect(second.positionsX.slice(0, first.count)).toEqual(first.positionsX.slice(0, first.count));
  });

  it('uses chunk-local queries and reservations so workers do not target the same node', () => {
    const store = createResourceNodeStore(256, 8);
    const close = addResourceNode(store, {
      kind: ResourceNodeKind.Tree,
      x: 20.25,
      z: 20.5,
      amount: 4,
      stage: ResourceNodeStage.Mature,
    });
    addResourceNode(store, {
      kind: ResourceNodeKind.Tree,
      x: 70.5,
      z: 70.5,
      amount: 8,
      stage: ResourceNodeStage.Mature,
    });

    expect(findNearestAvailableResourceNode(store, 20, 20, ResourceNodeKind.Tree, 10, 22)).toBe(
      close,
    );
    expect(reserveResourceNode(store, close, 4, 10, 60)).toBe(true);
    expect(findNearestAvailableResourceNode(store, 20, 20, ResourceNodeKind.Tree, 10, 22)).toBe(-1);
    expect(findNearestAvailableResourceNode(store, 20, 20, ResourceNodeKind.Tree, 71, 22)).toBe(
      close,
    );
  });

  it('provides local soft avoidance without changing the global navigation grid', () => {
    const store = createResourceNodeStore(64, 8);
    addResourceNode(store, {
      kind: ResourceNodeKind.Tree,
      x: 10.5,
      z: 10.5,
      amount: 4,
    });

    const avoidance = resourceNodeAvoidance(store, 10.1, 10.5, 0.8);
    expect(avoidance.x).toBeLessThan(0);
    expect(Math.abs(avoidance.z)).toBeLessThan(0.01);
  });

  it('turns a harvested tree into a stump and advances only due regrowth events', () => {
    const map = generateWorldMap('tree-regrowth', 32, 'continent');
    const store = createResourceNodeStore(32, 4);
    const nodeId = addResourceNode(store, {
      kind: ResourceNodeKind.Tree,
      x: 16.5,
      z: 16.5,
      amount: 1,
      stage: ResourceNodeStage.Mature,
    });
    map.terrain[16 * map.size + 16] = TerrainType.Forest;
    map.moisture[16 * map.size + 16] = 180;

    expect(harvestResourceNode(store, nodeId, 100)).toMatchObject({ amount: 1, depleted: true });
    expect(store.stage[nodeId]).toBe(ResourceNodeStage.Stump);
    const firstDue = store.regrowAtTick[nodeId] ?? 0;
    expect(advanceResourceRegrowth(store, map, firstDue - 1, 8)).toBe(0);
    expect(advanceResourceRegrowth(store, map, firstDue, 8)).toBe(1);
    expect(store.stage[nodeId]).toBe(ResourceNodeStage.Sapling);

    const secondDue = store.regrowAtTick[nodeId] ?? 0;
    advanceResourceRegrowth(store, map, secondDue, 8);
    expect(store.stage[nodeId]).toBe(ResourceNodeStage.Young);
    const thirdDue = store.regrowAtTick[nodeId] ?? 0;
    advanceResourceRegrowth(store, map, thirdDue, 8);
    expect(store.stage[nodeId]).toBe(ResourceNodeStage.Mature);
    expect(store.amount[nodeId]).toBeGreaterThan(0);
  });

  it('keeps surface stone and metal veins finite instead of scheduling natural regrowth', () => {
    const store = createResourceNodeStore(64, 4);
    for (const kind of [ResourceNodeKind.Stone, ResourceNodeKind.Metal]) {
      const nodeId = addResourceNode(store, {
        kind,
        x: 12.5 + kind,
        z: 10.5,
        amount: 1,
        stage: ResourceNodeStage.Mature,
      });
      harvestResourceNode(store, nodeId, 20);
      expect(store.stage[nodeId]).toBe(ResourceNodeStage.Depleted);
      expect(store.regrowAtTick[nodeId]).toBe(0);
    }
  });

  it('keeps a fixed-seed forest viable through one hundred years of sustainable harvesting', () => {
    const map = generateWorldMap('century-forest', 128, 'continent');
    const store = generateResourceNodes(map, 'century-forest');
    const initialTrees = Array.from({ length: store.count }, (_, nodeId) => nodeId).filter(
      (nodeId) => store.kind[nodeId] === ResourceNodeKind.Tree,
    );

    for (let year = 0; year < 100; year += 1) {
      const tick = year * 720;
      for (const nodeId of initialTrees) {
        if (
          store.stage[nodeId] === ResourceNodeStage.Mature &&
          (nodeId * 17 + year * 31) % 53 === 0
        ) {
          harvestResourceNode(store, nodeId, tick, 999);
        }
      }
      advanceResourceRegrowth(store, map, tick + 720, store.count);
    }

    const matureTrees = initialTrees.filter(
      (nodeId) => store.active[nodeId] === 1 && store.stage[nodeId] === ResourceNodeStage.Mature,
    ).length;
    expect(matureTrees / initialTrees.length).toBeGreaterThan(0.82);
  });
});
