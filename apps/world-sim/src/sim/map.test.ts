import { describe, expect, it } from 'vitest';
import { createWorldMap, getChunkKey } from './map';

describe('world map generation', () => {
  it('generates the same map for the same seed', () => {
    const first = createWorldMap('same-seed', 24, 18);
    const second = createWorldMap('same-seed', 24, 18);

    expect(second.tiles).toEqual(first.tiles);
  });

  it('indexes tiles by chunk', () => {
    const map = createWorldMap('chunks', 40, 40);
    const key = getChunkKey(17, 17);

    expect(map.chunks.get(key)?.length).toBeGreaterThan(0);
  });
});
