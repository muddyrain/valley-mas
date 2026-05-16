import { vi } from 'vitest';

class MockVector2 {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  clone() {
    return new MockVector2(this.x, this.y);
  }
}

vi.mock('phaser', () => ({
  Math: {
    Vector2: MockVector2,
    Distance: {
      Between: (x1: number, y1: number, x2: number, y2: number) => {
        return Math.hypot(x1 - x2, y1 - y2);
      },
    },
    Clamp: (value: number, min: number, max: number) => {
      return Math.min(max, Math.max(min, value));
    },
  },
}));
