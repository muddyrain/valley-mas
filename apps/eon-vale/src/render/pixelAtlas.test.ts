import { describe, expect, it, vi } from 'vitest';
import { PixelAtlasSlotAllocator } from './pixelAtlas';

describe('PixelAtlasSlotAllocator', () => {
  it('reuses cached slots without advancing the atlas', () => {
    const allocator = new PixelAtlasSlotAllocator(2);

    expect(allocator.allocate('resident')).toEqual({ slot: 0, cached: false });
    expect(allocator.allocate('resident')).toEqual({ slot: 0, cached: true });
    expect(allocator.allocate('building')).toEqual({ slot: 1, cached: false });
  });

  it('resets the historical cache instead of crashing when the atlas is full', () => {
    const onReset = vi.fn();
    const allocator = new PixelAtlasSlotAllocator(2, onReset);

    allocator.allocate('old-resident');
    allocator.allocate('old-building');

    expect(allocator.allocate('current-building')).toEqual({ slot: 0, cached: false });
    expect(onReset).toHaveBeenCalledOnce();
    expect(allocator.allocate('current-building')).toEqual({ slot: 0, cached: true });
  });
});
