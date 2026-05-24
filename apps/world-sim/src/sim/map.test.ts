import { describe, expect, it } from 'vitest';
import { createWorldMap, DEFAULT_WORLD_HEIGHT, DEFAULT_WORLD_WIDTH, getChunkKey } from './map';

describe('world map generation', () => {
  it('uses the foundation map size by default', () => {
    const map = createWorldMap('default-size');

    expect(map.width).toBe(128);
    expect(map.height).toBe(128);
    expect(map.tiles).toHaveLength(DEFAULT_WORLD_WIDTH * DEFAULT_WORLD_HEIGHT);
  });

  it('generates the same map for the same seed', () => {
    const first = createWorldMap('same-seed', 24, 18);
    const second = createWorldMap('same-seed', 24, 18);

    expect(second.tiles).toEqual(first.tiles);
  });

  it('changes the terrain layout for different same-length seeds', () => {
    const first = createWorldMap('worldsim-aa-111111', 48, 36);
    const second = createWorldMap('worldsim-bb-222222', 48, 36);
    const firstTerrain = first.tiles.map((tile) => tile.terrain).join(',');
    const secondTerrain = second.tiles.map((tile) => tile.terrain).join(',');

    expect(secondTerrain).not.toBe(firstTerrain);
  });

  it('indexes tiles by chunk', () => {
    const map = createWorldMap('chunks', 40, 40);
    const key = getChunkKey(17, 17);

    expect(map.chunks.get(key)?.length).toBeGreaterThan(0);
  });
});
