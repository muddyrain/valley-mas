import { describe, expect, it, vi } from 'vitest';
import { PreparedWindowSlot } from './prepared-window';

describe('prepared capture window slot', () => {
  it('hands a warm window to one shortcut activation only', () => {
    const warm = { isDestroyed: () => false, destroy: vi.fn() };
    const slot = new PreparedWindowSlot<typeof warm>();
    slot.store(warm);

    expect(slot.take()).toBe(warm);
    expect(slot.take()).toBeUndefined();
    expect(warm.destroy).not.toHaveBeenCalled();
  });

  it('discards destroyed windows and destroys a replaced warm window', () => {
    const first = { isDestroyed: () => false, destroy: vi.fn() };
    const replacement = { isDestroyed: () => false, destroy: vi.fn() };
    const destroyed = { isDestroyed: () => true, destroy: vi.fn() };
    const slot = new PreparedWindowSlot<typeof first>();

    slot.store(first);
    slot.store(replacement);
    expect(first.destroy).toHaveBeenCalledTimes(1);
    slot.store(destroyed);
    expect(replacement.destroy).toHaveBeenCalledTimes(1);
    expect(slot.take()).toBeUndefined();
  });
});
