import { describe, expect, it } from 'vitest';
import { ResourceNodeKind } from '@/shared/gameTypes';
import {
  addResourceNode,
  createResourceNodeStore,
  harvestResourceNode,
} from '@/simulation/resources/resourceNodes';
import { createFullResourceSnapshot, drainResourceNodeDelta } from './resourceSync';

describe('resource node worker sync', () => {
  it('sends one full snapshot followed by unique dirty-node deltas', () => {
    const store = createResourceNodeStore(384, 8);
    const tree = addResourceNode(store, {
      kind: ResourceNodeKind.Tree,
      x: 40.5,
      z: 44.5,
      amount: 6,
    });
    const stone = addResourceNode(store, {
      kind: ResourceNodeKind.Stone,
      x: 80.5,
      z: 84.5,
      amount: 8,
    });

    const full = createFullResourceSnapshot(store);
    expect(full.full).toBe(true);
    expect(full.count).toBe(2);
    expect(Array.from(full.nodeIds)).toEqual([tree, stone]);
    expect(store.dirtyNodeIds).toEqual([]);

    harvestResourceNode(store, tree, 10, 2);
    harvestResourceNode(store, tree, 11, 1);
    const delta = drainResourceNodeDelta(store);
    expect(delta?.full).toBe(false);
    expect(Array.from(delta?.nodeIds ?? [])).toEqual([tree]);
    expect(delta?.amount[0]).toBe(3);
    expect(drainResourceNodeDelta(store)).toBeNull();
  });
});
