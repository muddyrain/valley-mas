import { clampRectToBounds, type Point, type Rectangle } from './geometry';

export type NativeWindowTarget = Rectangle & {
  id: string;
  title: string;
  processId: number;
  kind?: 'window' | 'system-ui';
  isToolWindow?: boolean;
  isCloaked?: boolean;
};

export type WindowTarget = {
  id: string;
  title: string;
  rect: Rectangle;
};

export function mapWindowTargetsToDisplay(
  values: readonly NativeWindowTarget[],
  displayBounds: Rectangle,
  screenToDip: (rect: Rectangle) => Rectangle,
  ownProcessId: number,
): WindowTarget[] {
  const result: WindowTarget[] = [];
  for (const value of values.slice(0, 256)) {
    const minimumSize = value.kind === 'system-ui' ? 8 : 16;
    if (
      value.processId === ownProcessId ||
      value.isToolWindow ||
      value.isCloaked ||
      !value.id ||
      !value.title.trim() ||
      ![value.x, value.y, value.width, value.height].every(Number.isFinite) ||
      value.width < minimumSize ||
      value.height < minimumSize
    ) {
      continue;
    }
    const clipped = clampRectToBounds(screenToDip(value), displayBounds);
    if (clipped.width < minimumSize || clipped.height < minimumSize) continue;
    result.push({
      id: value.id.slice(0, 128),
      title: value.title.trim().slice(0, 160),
      rect: {
        x: clipped.x - displayBounds.x,
        y: clipped.y - displayBounds.y,
        width: clipped.width,
        height: clipped.height,
      },
    });
  }
  return result;
}

export function findWindowTargetAt(
  targets: readonly WindowTarget[],
  point: Point,
): WindowTarget | undefined {
  return targets.find(({ rect }) => {
    return (
      point.x >= rect.x &&
      point.y >= rect.y &&
      point.x < rect.x + rect.width &&
      point.y < rect.y + rect.height
    );
  });
}

export function findWindowTargetAtOrDisplay(
  targets: readonly WindowTarget[],
  point: Point,
  displayBounds: Rectangle,
): WindowTarget {
  return (
    findWindowTargetAt(targets, point) ?? {
      id: '__display__',
      title: '全屏',
      rect: { ...displayBounds },
    }
  );
}
