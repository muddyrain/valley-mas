import type { WorldMap } from '@/shared/gameTypes';
import { isWalkable } from '../navigation/grid';
import { hasLineOfSight } from '../navigation/simplifyPath';

export type GridResourceKind = 'food' | 'wood' | 'stone';

function resourceArray(map: WorldMap, kind: GridResourceKind): Uint16Array {
  if (kind === 'food') return map.resourceFood;
  if (kind === 'wood') return map.resourceWood;
  return map.resourceStone;
}

export function findNearestGridResource(
  map: WorldMap,
  origin: number,
  kind: GridResourceKind,
  maxRadius = 22,
  requireLineOfSight = false,
  acceptCell: (cell: number) => boolean = () => true,
): number {
  const source = resourceArray(map, kind);
  const originX = origin % map.size;
  const originZ = Math.floor(origin / map.size);
  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (
      let z = Math.max(0, originZ - radius);
      z <= Math.min(map.size - 1, originZ + radius);
      z += 1
    ) {
      for (
        let x = Math.max(0, originX - radius);
        x <= Math.min(map.size - 1, originX + radius);
        x += 1
      ) {
        if (Math.max(Math.abs(x - originX), Math.abs(z - originZ)) !== radius) continue;
        const cell = z * map.size + x;
        if (
          (source[cell] ?? 0) === 0 ||
          !acceptCell(cell) ||
          !isWalkable(map.navigation, cell) ||
          (requireLineOfSight && !hasLineOfSight(map.navigation, origin, cell))
        )
          continue;
        const distance = Math.abs(x - originX) + Math.abs(z - originZ);
        if (distance < bestDistance) {
          best = cell;
          bestDistance = distance;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

export function harvestGridResource(map: WorldMap, cell: number, kind: GridResourceKind): number {
  const source = resourceArray(map, kind);
  if ((source[cell] ?? 0) <= 0) return 0;
  source[cell] -= 1;
  return 1;
}
