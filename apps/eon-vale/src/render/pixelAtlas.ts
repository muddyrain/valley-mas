export interface PixelAtlasAllocation {
  slot: number;
  cached: boolean;
}

export class PixelAtlasSlotAllocator {
  private readonly slots = new Map<string, number>();
  private nextSlot = 0;

  constructor(
    private readonly capacity: number,
    private readonly onReset?: () => void,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Pixel atlas capacity must be a positive integer');
    }
  }

  allocate(key: string): PixelAtlasAllocation {
    const cachedSlot = this.slots.get(key);
    if (cachedSlot !== undefined) return { slot: cachedSlot, cached: true };

    if (this.nextSlot >= this.capacity) {
      this.slots.clear();
      this.nextSlot = 0;
      this.onReset?.();
    }

    const slot = this.nextSlot;
    this.nextSlot += 1;
    this.slots.set(key, slot);
    return { slot, cached: false };
  }
}
