import type { WorldMap } from '@/shared/gameTypes';

export function markMapCellDirty(map: WorldMap, cell: number): void {
  if (cell >= 0 && cell < map.terrain.length) map.dirtyMapCells.push(cell);
}
