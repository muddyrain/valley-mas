import { describe, expect, it } from 'vitest';
import { generateWorldMap } from '@/simulation/map/generateWorldMap';
import { markMapCellDirty } from '@/simulation/map/mapDirty';
import { drainWorldMapDelta } from './mapDeltaSync';

describe('world map delta sync', () => {
  it('deduplicates dirty cells and transfers only their latest values', () => {
    const map = generateWorldMap('map-delta', 128, 'continent');
    const cell = 12 * map.size + 18;
    map.fire[cell] = 120;
    markMapCellDirty(map, cell);
    map.fire[cell] = 190;
    markMapCellDirty(map, cell);

    const delta = drainWorldMapDelta(map);
    expect(Array.from(delta?.cells ?? [])).toEqual([cell]);
    expect(delta?.fire[0]).toBe(190);
    expect(drainWorldMapDelta(map)).toBeNull();
  });
});
