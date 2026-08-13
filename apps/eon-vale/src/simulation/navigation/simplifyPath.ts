import { cellX, cellZ, isWalkable, type NavigationGrid, toCell } from './grid';

export function hasLineOfSight(
  grid: NavigationGrid,
  start: number,
  end: number,
  maxIntermediateCost = Number.POSITIVE_INFINITY,
): boolean {
  let x0 = cellX(grid, start);
  let z0 = cellZ(grid, start);
  const x1 = cellX(grid, end);
  const z1 = cellZ(grid, end);
  const deltaX = Math.abs(x1 - x0);
  const deltaZ = Math.abs(z1 - z0);
  const stepX = x0 < x1 ? 1 : -1;
  const stepZ = z0 < z1 ? 1 : -1;
  let error = deltaX - deltaZ;

  while (true) {
    const current = toCell(grid, x0, z0);
    if (!isWalkable(grid, current)) return false;
    if (current !== end && (grid.cost[current] ?? 0) > maxIntermediateCost) return false;
    if (x0 === x1 && z0 === z1) return true;
    const doubled = error * 2;
    const previousX = x0;
    const previousZ = z0;
    if (doubled > -deltaZ) {
      error -= deltaZ;
      x0 += stepX;
    }
    if (doubled < deltaX) {
      error += deltaX;
      z0 += stepZ;
    }
    if (x0 !== previousX && z0 !== previousZ) {
      const cornerA = toCell(grid, previousX, z0);
      const cornerB = toCell(grid, x0, previousZ);
      if (
        !isWalkable(grid, cornerA) ||
        !isWalkable(grid, cornerB) ||
        (cornerA !== end && (grid.cost[cornerA] ?? 0) > maxIntermediateCost) ||
        (cornerB !== end && (grid.cost[cornerB] ?? 0) > maxIntermediateCost)
      ) {
        return false;
      }
    }
  }
}

export function simplifyPath(grid: NavigationGrid, path: readonly number[]): number[] {
  if (path.length <= 2) return [...path];
  const simplified = [path[0] as number];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1) {
      let maxRouteCost = 0;
      for (let index = anchor + 1; index < next; index += 1) {
        maxRouteCost = Math.max(maxRouteCost, grid.cost[path[index] as number] ?? 0);
      }
      if (hasLineOfSight(grid, path[anchor] as number, path[next] as number, maxRouteCost)) {
        break;
      }
      next -= 1;
    }
    simplified.push(path[next] as number);
    anchor = next;
  }
  return simplified;
}
