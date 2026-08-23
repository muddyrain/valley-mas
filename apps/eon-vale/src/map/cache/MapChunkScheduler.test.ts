import { describe, expect, it } from 'vitest';

import { ChunkRenderCache, planViewportChunks } from './MapChunkScheduler';

describe('planViewportChunks', () => {
  it('returns every visible chunk and orders work from the viewport center', () => {
    const plan = planViewportChunks({
      centerX: 512,
      centerY: 512,
      viewportWidthPx: 1024,
      viewportHeightPx: 768,
      zoom: 2,
      cellPixels: 4,
    });

    expect(plan.visible.map(({ index }) => index)).toEqual([136, 135, 120, 119]);
    expect(new Set(plan.required.map(({ index }) => index)).size).toBe(plan.required.length);
    expect(plan.required.slice(0, plan.visible.length)).toEqual(plan.visible);
    expect(plan.prefetch.length).toBeGreaterThan(0);
  });

  it('clamps visible and prefetch coordinates to the 1024-cell world', () => {
    const plan = planViewportChunks({
      centerX: 8,
      centerY: 8,
      viewportWidthPx: 1600,
      viewportHeightPx: 1000,
      zoom: 3,
      cellPixels: 4,
    });

    expect(plan.required.every(({ x, y }) => x >= 0 && y >= 0 && x < 16 && y < 16)).toBe(true);
    expect(plan.visible.some(({ index }) => index === 0)).toBe(true);
  });
});

describe('ChunkRenderCache', () => {
  it('evicts the least-recently-used unprotected chunk and reports it for GPU disposal', () => {
    const cache = new ChunkRenderCache<string>(12);
    cache.set(1, 'one', 4);
    cache.set(2, 'two', 4);
    cache.set(3, 'three', 4);
    cache.protect(new Set([1]));
    cache.get(2);

    expect(cache.set(4, 'four', 4)).toEqual([{ key: 3, value: 'three' }]);
    expect(cache.get(1)).toBe('one');
    expect(cache.get(2)).toBe('two');
    expect(cache.get(3)).toBeUndefined();
    expect(cache.get(4)).toBe('four');
  });
});
