import type { TownCollider } from './town-navigation';

export type CameraPoint = readonly [number, number, number];

const intersectAxis = (
  origin: number,
  direction: number,
  minimum: number,
  maximum: number,
  interval: [number, number],
): boolean => {
  if (Math.abs(direction) < 0.0001) return origin >= minimum && origin <= maximum;
  const first = (minimum - origin) / direction;
  const second = (maximum - origin) / direction;
  interval[0] = Math.max(interval[0], Math.min(first, second));
  interval[1] = Math.min(interval[1], Math.max(first, second));
  return interval[0] <= interval[1];
};

export function clipCameraAgainstColliders(
  target: CameraPoint,
  desired: CameraPoint,
  colliders: readonly TownCollider[],
): [number, number, number] {
  const direction: [number, number, number] = [
    desired[0] - target[0],
    desired[1] - target[1],
    desired[2] - target[2],
  ];
  const rayLength = Math.hypot(...direction);
  if (rayLength <= 0.001) return [...desired];

  let firstHit = 1;
  for (const collider of colliders) {
    const interval: [number, number] = [0, 1];
    const padding = 0.42;
    if (
      !intersectAxis(
        target[0],
        direction[0],
        collider.center[0] - collider.halfSize[0] - padding,
        collider.center[0] + collider.halfSize[0] + padding,
        interval,
      ) ||
      !intersectAxis(
        target[2],
        direction[2],
        collider.center[1] - collider.halfSize[1] - padding,
        collider.center[1] + collider.halfSize[1] + padding,
        interval,
      )
    ) {
      continue;
    }
    const hitY = target[1] + direction[1] * interval[0];
    if (hitY > collider.height + 0.55) continue;
    firstHit = Math.min(firstHit, interval[0]);
  }

  if (firstHit >= 1) return [...desired];
  const safeProgress = Math.max(0.08, firstHit - 0.3 / rayLength);
  return [
    target[0] + direction[0] * safeProgress,
    target[1] + direction[1] * safeProgress,
    target[2] + direction[2] * safeProgress,
  ];
}
