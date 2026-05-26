import { describe, expect, it } from 'vitest';
import {
  getCachedTerrainFillAlpha,
  getChunkKeyForTile,
  getRenderChunkBounds,
  getSeamSafeRenderTextureSize,
  getSeamSafeTileRunRect,
  getTileExtents,
  getVisibleChunkKeySignature,
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

  it('builds a stable visible chunk signature for terrain refreshes', () => {
    expect(
      getVisibleChunkKeySignature(
        [
          { x: 35, y: 40 },
          { x: 0, y: 0 },
          { x: 35, y: 1 },
        ],
        32,
      ),
    ).toBe('0:0|1:0|1:1');
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

  it('overdraws cached chunk textures by one pixel to hide fractional zoom seams', () => {
    expect(getSeamSafeRenderTextureSize({ width: 32, height: 11 }, 10)).toEqual({
      width: 321,
      height: 111,
    });
  });

  it('overdraws tile runs by one pixel inside cached textures', () => {
    expect(
      getSeamSafeTileRunRect(
        {
          x: 34,
          y: 66,
          width: 3,
        },
        {
          tileX: 32,
          tileY: 64,
        },
        10,
      ),
    ).toEqual({
      x: 20,
      y: 20,
      width: 31,
      height: 11,
    });
  });

  it('keeps cached terrain opaque so chunk-edge overdraw cannot create dashed seams', () => {
    expect(getCachedTerrainFillAlpha()).toBe(1);
  });
});
