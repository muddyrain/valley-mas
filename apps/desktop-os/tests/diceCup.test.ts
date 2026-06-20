import { describe, expect, it } from 'vitest';
import {
  createDicePlacements3D,
  DICE_CUP_BOARD_RADIUS,
  DICE_CUP_DIE_FOOTPRINT_RADIUS,
  rollDice,
} from '../src/tools/miniGamesV2';

describe('dice cup logic', () => {
  it('rolls five dice by default', () => {
    const values = rollDice();

    expect(values).toHaveLength(5);
  });

  it('keeps every die between one and six', () => {
    const values = rollDice(20);

    expect(values.every((value) => value >= 1 && value <= 6)).toBe(true);
  });

  it('places 3D dice inside the tray without overlapping each other', () => {
    let seed = 0;
    const values = [
      0.12, 0.88, 0.24, 0.64, 0.42, 0.18, 0.76, 0.34, 0.58, 0.92, 0.08, 0.72, 0.48, 0.28,
    ];
    const placements = createDicePlacements3D(5, () => values[seed++ % values.length]);

    expect(placements).toHaveLength(5);
    for (let i = 0; i < placements.length; i += 1) {
      expect(Math.hypot(placements[i].x, placements[i].z)).toBeLessThanOrEqual(
        DICE_CUP_BOARD_RADIUS - DICE_CUP_DIE_FOOTPRINT_RADIUS,
      );
      for (let j = i + 1; j < placements.length; j += 1) {
        const dx = placements[i].x - placements[j].x;
        const dz = placements[i].z - placements[j].z;
        expect(Math.hypot(dx, dz)).toBeGreaterThanOrEqual(DICE_CUP_DIE_FOOTPRINT_RADIUS * 2);
      }
    }
  });
});
