import { describe, expect, it } from 'vitest';
import { createGroundTown } from './createGroundTown';
import { createWorldDebugSystem } from './WorldDebugSystem';

describe('WorldDebugSystem', () => {
  it('把碰撞体、居民路线和车辆路线装配为可见线框', () => {
    const town = createGroundTown();
    const debug = createWorldDebugSystem(town.colliders, town.pedestrianGraph, town.vehicleGraph);

    expect(debug.root.getObjectByName('debug-colliders')).toBeTruthy();
    expect(debug.root.getObjectByName('debug-pedestrian-routes')).toBeTruthy();
    expect(debug.root.getObjectByName('debug-vehicle-routes')).toBeTruthy();

    debug.dispose();
    town.dispose();
  });
});
