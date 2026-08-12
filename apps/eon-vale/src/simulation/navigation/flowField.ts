import { cellX, cellZ, isWalkable, type NavigationGrid } from './grid';

export interface FlowField {
  target: number;
  next: Int32Array;
  distance: Uint32Array;
}

export function createFlowField(grid: NavigationGrid, target: number): FlowField {
  const next = new Int32Array(grid.cost.length);
  next.fill(-1);
  const distance = new Uint32Array(grid.cost.length);
  distance.fill(0xffff_ffff);
  if (!isWalkable(grid, target)) return { target, next, distance };
  const queue = new Uint32Array(grid.cost.length);
  let head = 0;
  let tail = 0;
  queue[tail] = target;
  tail += 1;
  distance[target] = 0;
  next[target] = target;

  while (head < tail) {
    const current = queue[head] as number;
    head += 1;
    const x = cellX(grid, current);
    const z = cellZ(grid, current);
    const neighbours = [
      x > 0 ? current - 1 : -1,
      x + 1 < grid.width ? current + 1 : -1,
      z > 0 ? current - grid.width : -1,
      z + 1 < grid.height ? current + grid.width : -1,
    ];
    for (const neighbour of neighbours) {
      if (neighbour < 0 || !isWalkable(grid, neighbour) || distance[neighbour] !== 0xffff_ffff)
        continue;
      distance[neighbour] = (distance[current] ?? 0) + 1;
      next[neighbour] = current;
      queue[tail] = neighbour;
      tail += 1;
    }
  }
  return { target, next, distance };
}

export function nextFlowCell(field: FlowField, cell: number): number {
  const next = field.next[cell];
  return next === undefined || next < 0 ? cell : next;
}
