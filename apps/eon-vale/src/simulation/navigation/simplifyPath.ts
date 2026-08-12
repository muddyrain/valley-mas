import { cellX, cellZ, isWalkable, type NavigationGrid, toCell } from './grid';

export function hasLineOfSight(grid: NavigationGrid, start: number, end: number): boolean {
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
    if (!isWalkable(grid, toCell(grid, x0, z0))) return false;
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
      if (
        !isWalkable(grid, toCell(grid, previousX, z0)) ||
        !isWalkable(grid, toCell(grid, x0, previousZ))
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
    while (next > anchor + 1 && !hasLineOfSight(grid, path[anchor] as number, path[next] as number))
      next -= 1;
    simplified.push(path[next] as number);
    anchor = next;
  }
  return simplified;
}
