import { describe, expect, it } from 'vitest';
import { clipCameraAgainstColliders } from './camera-collision';
import type { TownCollider } from './town-navigation';

const building: TownCollider = {
  id: 'house',
  center: [0, 2],
  halfSize: [1.5, 1],
  height: 4,
  vaultable: false,
};

describe('camera collision', () => {
  it('建筑挡在目标和跟随镜头之间时把镜头推到建筑前方', () => {
    const clipped = clipCameraAgainstColliders([0, 1, 0], [0, 2.4, 6], [building]);

    expect(clipped[2]).toBeGreaterThan(0);
    expect(clipped[2]).toBeLessThan(1);
  });

  it('镜头射线越过建筑顶部或没有遮挡时保持原位置', () => {
    expect(clipCameraAgainstColliders([0, 8, 0], [0, 9, 6], [building])).toEqual([0, 9, 6]);
    expect(clipCameraAgainstColliders([5, 1, 0], [5, 2.4, 6], [building])).toEqual([5, 2.4, 6]);
  });
});
