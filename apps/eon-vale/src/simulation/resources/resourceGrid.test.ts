import { describe, expect, it } from 'vitest';
import { TerrainType } from '@/shared/gameTypes';
import { generateWorldMap } from '../map/generateWorldMap';
import { findNearestGridResource, harvestGridResource } from './resourceGrid';

describe('legacy resource grid boundary', () => {
  it('finds the closest reachable resource without searching the full world', () => {
    const map = generateWorldMap('resource-boundary', 32, 'continent');
    map.terrain.fill(TerrainType.Grass);
    map.navigation.cost.fill(4);
    map.resourceWood.fill(0);
    const origin = 16 * map.size + 16;
    map.resourceWood[origin + 3] = 9;
    map.resourceWood[origin + map.size * 8] = 20;

    expect(findNearestGridResource(map, origin, 'wood', 6)).toBe(origin + 3);
  });

  it('harvests exactly one unit and never creates a negative resource value', () => {
    const map = generateWorldMap('resource-harvest', 32, 'continent');
    const cell = 12 * map.size + 12;
    map.resourceStone[cell] = 1;

    expect(harvestGridResource(map, cell, 'stone')).toBe(1);
    expect(harvestGridResource(map, cell, 'stone')).toBe(0);
    expect(map.resourceStone[cell]).toBe(0);
  });
});
