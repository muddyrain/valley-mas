import type { SimWorld } from './SimWorld';

export const FIXED_TICK_MS = 250;

export class SimLoop {
  private accumulatorMs = 0;

  constructor(private readonly world: SimWorld) {}

  advance(deltaMs: number) {
    this.accumulatorMs += deltaMs * this.world.speed;

    while (this.accumulatorMs >= FIXED_TICK_MS) {
      this.world.step();
      this.accumulatorMs -= FIXED_TICK_MS;
    }
  }
}
