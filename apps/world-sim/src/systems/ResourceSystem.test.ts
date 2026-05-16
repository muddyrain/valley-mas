import * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { createSmallTestMap } from '../test/createTestMap';
import { ResourceSystem, STOCKPILE_TARGETS } from './ResourceSystem';

describe('ResourceSystem', () => {
  it('harvests wood into inventory and keeps the forest while resources remain', () => {
    const map = createSmallTestMap([
      {
        x: 1,
        y: 1,
        terrainType: 'forest',
        resourceType: 'wood',
        resourceAmount: 5,
      },
    ]);
    const system = new ResourceSystem(map);

    const result = system.harvestAt(new Phaser.Math.Vector2(24, 24));

    expect(result).toMatchObject({
      resourceType: 'wood',
      amount: 2,
      depleted: false,
    });
    expect(map.tiles[5]).toMatchObject({
      terrainType: 'forest',
      resourceType: 'wood',
      resourceAmount: 3,
    });
    expect(system.getInventory().wood).toBe(12);
  });

  it('turns a depleted forest resource tile into grass', () => {
    const map = createSmallTestMap([
      {
        x: 1,
        y: 1,
        terrainType: 'forest',
        resourceType: 'wood',
        resourceAmount: 1,
      },
    ]);
    const system = new ResourceSystem(map);

    const result = system.harvestAt(new Phaser.Math.Vector2(24, 24));

    expect(result).toMatchObject({
      resourceType: 'wood',
      amount: 1,
      depleted: true,
    });
    expect(map.tiles[5]).toMatchObject({
      terrainType: 'grass',
      resourceType: undefined,
      resourceAmount: 0,
    });
    expect(system.getInventory().wood).toBe(11);
  });

  it('finds the nearest harvest target and ignores blocked terrain', () => {
    const map = createSmallTestMap([
      {
        x: 0,
        y: 0,
        terrainType: 'water',
        resourceType: 'food',
        resourceAmount: 8,
      },
      {
        x: 2,
        y: 1,
        terrainType: 'mountain',
        resourceType: 'stone',
        resourceAmount: 20,
      },
    ]);
    const system = new ResourceSystem(map);

    const target = system.findNearestHarvestTarget(new Phaser.Math.Vector2(2, 2));

    expect(target).toEqual(new Phaser.Math.Vector2(40, 24));
  });

  it('prioritizes unmet stockpile needs and stops harvesting when targets are met', () => {
    const map = createSmallTestMap([
      {
        x: 0,
        y: 0,
        terrainType: 'grass',
        resourceType: 'food',
        resourceAmount: 8,
      },
      {
        x: 1,
        y: 1,
        terrainType: 'forest',
        resourceType: 'wood',
        resourceAmount: 10,
      },
      {
        x: 2,
        y: 1,
        terrainType: 'mountain',
        resourceType: 'stone',
        resourceAmount: 20,
      },
    ]);
    const system = new ResourceSystem(map);

    expect(system.getHarvestPriorityTypes()).toEqual(['food', 'wood', 'stone', 'iron']);
    expect(system.needsHarvest()).toBe(true);
    expect(system.hasHarvestableResource(['food'])).toBe(true);

    const target = system.findNearestHarvestTarget(new Phaser.Math.Vector2(2, 2), ['food']);

    expect(target).toEqual(new Phaser.Math.Vector2(8, 8));

    Object.assign(system as unknown as { inventory: Record<string, number> }, {
      inventory: {
        food: STOCKPILE_TARGETS.food,
        wood: STOCKPILE_TARGETS.wood,
        stone: STOCKPILE_TARGETS.stone,
        iron: STOCKPILE_TARGETS.iron,
      },
    });

    expect(system.needsHarvest()).toBe(false);
    expect(system.getHarvestPriorityTypes()).toEqual([]);
  });
});
