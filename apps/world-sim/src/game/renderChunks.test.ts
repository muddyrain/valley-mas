import { describe, expect, it } from 'vitest';
import {
  getChunkKeyForTile,
  getRenderChunkBounds,
  getTileExtents,
  getVisibleChunkKeys,
} from './renderChunks';

describe('render chunk helpers', () => {
  it('builds bounded chunk rectangles at world edges', () => {
    expect(getRenderChunkBounds(1, 2, 70, 75, 32)).toEqual({
      key: '1:2',
      chunkX: 1,
      chunkY: 2,
      tileX: 32,
      tileY: 64,
      width: 32,
      height: 11,
    });
  });

  it('maps tiles to stable chunk keys', () => {
    expect(getChunkKeyForTile(0, 0, 32)).toBe('0:0');
    expect(getChunkKeyForTile(31, 31, 32)).toBe('0:0');
    expect(getChunkKeyForTile(32, 31, 32)).toBe('1:0');
  });

  it('collects visible chunk keys from viewport tiles', () => {
    expect([
      ...getVisibleChunkKeys(
        [
          { x: 0, y: 0 },
          { x: 35, y: 1 },
          { x: 35, y: 40 },
        ],
        32,
      ),
    ]).toEqual(['0:0', '1:0', '1:1']);
  });

  it('computes tile extents for viewport-sized render textures', () => {
    expect(
      getTileExtents([
        { x: 4, y: 7 },
        { x: 9, y: 6 },
        { x: 5, y: 10 },
      ]),
    ).toEqual({
      minX: 4,
      minY: 6,
      maxX: 9,
      maxY: 10,
      width: 6,
      height: 5,
    });
    expect(getTileExtents([])).toBeUndefined();
  });
});
