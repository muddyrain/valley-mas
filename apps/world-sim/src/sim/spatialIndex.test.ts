import { describe, expect, it } from 'vitest';
import { SpatialIndex } from './spatialIndex';
import type { Unit } from './types';

describe('SpatialIndex', () => {
  it('finds nearby units across chunk boundaries', () => {
    const index = new SpatialIndex();
    const left = createUnit('left', 15, 8);
    const right = createUnit('right', 17, 8);

    index.rebuild([left, right]);

    expect(index.nearbyUnitIds({ x: 15, y: 8 }, 3)).toEqual(
      expect.arrayContaining(['left', 'right']),
    );
  });
});

function createUnit(id: string, x: number, y: number): Unit {
  return {
    id,
    race: 'human',
    gender: 'female',
    position: { x, y },
    hp: 100,
    hunger: 0,
    ageTicks: 0,
    reproductionCooldownTicks: 0,
    intent: 'idle',
  };
}
